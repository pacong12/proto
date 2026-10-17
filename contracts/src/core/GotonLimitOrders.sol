// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey, PoolIdLibrary} from "../interfaces/IUniswapV4.sol";
import {IPoolManagerV4} from "../interfaces/external/IUniswapV4Core.sol";
import {TickMath} from "../libraries/v4/TickMath.sol";
import {V4Lib} from "../libraries/v4/V4Lib.sol";

interface IERC20LO {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface ICurveFactoryLO {
    function curveToToken(address curve) external view returns (address);
}

interface IBondingCurveLO {
    function virtualEthReserve() external view returns (uint256);
    function virtualTokenReserve() external view returns (uint256);
    function buyFor(address recipient, uint256 minTokensOut) external payable returns (uint256);
    function sell(uint256 tokenIn, uint256 minEthOut) external returns (uint256);
}

interface IGotonV4RouterLO {
    function swapExactIn(
        PoolKey calldata key,
        bool zeroForOne,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external payable returns (uint256 amountOut);
}

interface IGotonV4HookLO {
    function consultTick(bytes32 poolId) external view returns (int24 twapTick, uint32 window);
}

/**
 * @title GotonLimitOrders
 * @notice Non-custodial limit, take-profit and stop-loss orders for Goton tokens, held in escrow.
 *
 *         - Buy order: the owner deposits native quote (ETH on Robinhood Chain, native USDC on Arc)
 *           and a minimum token output. It fills whenever the market gives at least that output,
 *           i.e. at the limit price or better.
 *         - Sell order: the owner deposits tokens with a take-profit floor (`tpMinOut`), a stop-loss
 *           (`slPriceX36` trigger plus `slMinOut` floor), or both (one-cancels-other: one deposit,
 *           the first leg to fill closes the order).
 *
 *         Anyone may execute a fillable order and earns EXECUTOR_FEE_BPS of the quote side. The
 *         contract has no owner and no admin functions: escrowed funds can only fill an order on
 *         the owner's terms or return to the owner (cancel). Executors pick the route at execution,
 *         restricted to a bonding curve of the trusted factory or a Goton v4 pool via the trusted
 *         router, and every fill is checked against the owner's balance change, not router output.
 *
 *         Stop-loss triggers on the bonding curve's spot price, or on a v4 pool's TWAP (hook
 *         oracle) so that a one-block price push cannot trigger stops.
 */
contract GotonLimitOrders {
    using PoolIdLibrary for PoolKey;

    enum Leg {
        TakeProfit,
        StopLoss
    }

    struct Order {
        address owner;
        address token;
        bool isBuy;
        uint64 deadline;
        /// Buy: native quote deposited (wei). Sell: tokens deposited.
        uint256 amount;
        /// Buy: minimum tokens received. Sell: minimum quote for the take-profit leg (0 = none).
        uint256 minOut;
        /// Sell stop-loss trigger: quote raw units per token raw unit, times 1e36 (0 = none).
        uint256 slPriceX36;
        /// Sell stop-loss floor in quote raw units.
        uint256 slMinOut;
    }

    uint256 public constant EXECUTOR_FEE_BPS = 10; // 0.1%
    /// @notice `leg` value in OrderFilled for buy orders.
    uint8 public constant BUY_FILL = 2;
    uint256 private constant BPS = 10_000;
    uint256 private constant Q96 = 2 ** 96;

    /// @notice Factory whose bonding curves are valid routes (address(0) on chains without curves).
    address public immutable curveFactory;
    IGotonV4RouterLO public immutable router;
    IPoolManagerV4 public immutable poolManager;
    /// @notice Hook of Goton v4 pools; also the TWAP oracle for stop-loss triggers.
    address public immutable hook;
    /// @notice Quote asset of v4 pools: address(0) for native ETH, else the ERC-20 (Arc USDC).
    address public immutable quoteAsset;
    /// @notice msg.value units per quote raw unit when paying the router natively (1, or 1e12 on Arc).
    uint256 public immutable nativeScale;

    uint256 public nextOrderId = 1;
    mapping(uint256 => Order) public orders;

    uint256 private _locked;

    event OrderCreated(uint256 indexed id, address indexed owner, address indexed token, Order order);
    event OrderFilled(
        uint256 indexed id, address indexed executor, uint8 leg, uint256 amountIn, uint256 amountOut, uint256 fee
    );
    event OrderCancelled(uint256 indexed id);

    error InvalidOrder();
    error NotOwner();
    error UnknownOrder();
    error Expired();
    error InvalidRoute();
    error NotTriggered();
    error InsufficientOutput();
    error TransferFailed();
    error Reentrancy();

    modifier nonReentrant() {
        if (_locked == 1) revert Reentrancy();
        _locked = 1;
        _;
        _locked = 0;
    }

    constructor(
        address _curveFactory,
        IGotonV4RouterLO _router,
        IPoolManagerV4 _poolManager,
        address _hook,
        address _quoteAsset,
        uint256 _nativeScale
    ) {
        if (address(_router) == address(0) || address(_poolManager) == address(0) || _hook == address(0)) {
            revert InvalidRoute();
        }
        if (_nativeScale == 0) revert InvalidOrder();
        curveFactory = _curveFactory;
        router = _router;
        poolManager = _poolManager;
        hook = _hook;
        quoteAsset = _quoteAsset;
        nativeScale = _nativeScale;
    }

    /// @notice Receives native quote from curve sells and v4 swaps.
    receive() external payable {}

    // ---------------------------------------------------------------------------
    // Create / cancel
    // ---------------------------------------------------------------------------

    /**
     * @notice Limit buy: deposit native quote (msg.value), receive at least `minTokensOut`.
     * @param deadline Unix time after which the order can no longer fill (cancel still works).
     */
    function createBuyOrder(address token, uint256 minTokensOut, uint64 deadline)
        external
        payable
        returns (uint256 id)
    {
        if (token == address(0) || msg.value == 0 || minTokensOut == 0 || deadline <= block.timestamp) {
            revert InvalidOrder();
        }
        if (msg.value % nativeScale != 0) revert InvalidOrder();
        id = _store(Order(msg.sender, token, true, deadline, msg.value, minTokensOut, 0, 0));
    }

    /**
     * @notice Sell with a take-profit floor, a stop-loss, or both (OCO). Pulls `amount` tokens.
     * @param tpMinOut Quote out (raw units) at or above which the take-profit leg fills; 0 = none.
     * @param slPriceX36 Stop trigger: price (quote raw per token raw, x1e36) at or below which the
     *        stop-loss leg may fill; 0 = none.
     * @param slMinOut Quote floor for the stop-loss leg (trigger price minus the owner's slippage).
     */
    // slither-disable-next-line reentrancy-balance,incorrect-equality (nonReentrant; balance deltas measure what arrived; zero check; see docs/audit/AUDIT-VERIFICATION.md)
    function createSellOrder(
        address token,
        uint256 amount,
        uint256 tpMinOut,
        uint256 slPriceX36,
        uint256 slMinOut,
        uint64 deadline
    ) external nonReentrant returns (uint256 id) {
        if (token == address(0) || amount == 0 || deadline <= block.timestamp) revert InvalidOrder();
        if (tpMinOut == 0 && slPriceX36 == 0) revert InvalidOrder();
        if ((slPriceX36 == 0) != (slMinOut == 0)) revert InvalidOrder();
        // Escrow exactly what arrived, so a token that taxes this transfer cannot be under-funded.
        uint256 before = IERC20LO(token).balanceOf(address(this));
        if (!IERC20LO(token).transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        uint256 received = IERC20LO(token).balanceOf(address(this)) - before;
        if (received == 0) revert InvalidOrder();
        id = _store(Order(msg.sender, token, false, deadline, received, tpMinOut, slPriceX36, slMinOut));
    }

    /// @notice Returns the deposit to the owner. Works at any time, including after the deadline.
    function cancel(uint256 id) external nonReentrant {
        Order memory o = orders[id];
        if (o.owner == address(0)) revert UnknownOrder();
        if (msg.sender != o.owner) revert NotOwner();
        delete orders[id];
        if (o.isBuy) {
            _sendNative(o.owner, o.amount);
        } else if (!IERC20LO(o.token).transfer(o.owner, o.amount)) {
            revert TransferFailed();
        }
        emit OrderCancelled(id);
    }

    // ---------------------------------------------------------------------------
    // Execute
    // ---------------------------------------------------------------------------

    /// @notice Fills a buy order on a bonding curve of the trusted factory.
    // slither-disable-next-line unused-return (fills are checked against the owner's balance change, not the curve's return value; see docs/audit/AUDIT-VERIFICATION.md)
    function executeBuyOnCurve(uint256 id, IBondingCurveLO curve) external nonReentrant {
        Order memory o = _open(id, true);
        _checkCurve(curve, o.token);
        delete orders[id];
        (uint256 fee, uint256 spend) = _splitNative(o.amount);
        uint256 nativeBefore = address(this).balance;
        uint256 before = IERC20LO(o.token).balanceOf(o.owner);
        curve.buyFor{value: spend}(o.owner, 0);
        _finishBuy(id, o, fee, spend - _refundPartial(o.owner, nativeBefore - spend), before);
    }

    /// @notice Fills a buy order in a Goton v4 pool through the trusted router.
    // slither-disable-next-line unused-return (fills are checked against the owner's balance change, not the router's return value; see docs/audit/AUDIT-VERIFICATION.md)
    function executeBuyOnPool(uint256 id, PoolKey calldata key) external nonReentrant {
        Order memory o = _open(id, true);
        bool quoteIs0 = _checkPool(key, o.token);
        delete orders[id];
        (uint256 fee, uint256 spend) = _splitNative(o.amount);
        uint256 nativeBefore = address(this).balance;
        uint256 before = IERC20LO(o.token).balanceOf(o.owner);
        router.swapExactIn{value: spend}(key, quoteIs0, spend / nativeScale, 0, o.owner, block.timestamp);
        _finishBuy(id, o, fee, spend - _refundPartial(o.owner, nativeBefore - spend), before);
    }

    /// @notice Fills a sell order's take-profit or stop-loss leg on a bonding curve.
    // slither-disable-next-line unused-return,incorrect-equality (output measured as this contract's balance change; zero check; see docs/audit/AUDIT-VERIFICATION.md)
    function executeSellOnCurve(uint256 id, IBondingCurveLO curve, Leg leg) external nonReentrant {
        Order memory o = _open(id, false);
        _checkCurve(curve, o.token);
        if (leg == Leg.StopLoss) {
            if (o.slPriceX36 == 0) revert NotTriggered();
            uint256 spot = (curve.virtualEthReserve() * 1e36) / curve.virtualTokenReserve();
            if (spot > o.slPriceX36) revert NotTriggered();
        }
        delete orders[id];
        uint256 tokensBefore = IERC20LO(o.token).balanceOf(address(this));
        _approve(o.token, address(curve), o.amount);
        uint256 quoteBefore = address(this).balance;
        curve.sell(o.amount, 0);
        uint256 quoteOut = address(this).balance - quoteBefore;
        _finishSell(id, o, leg, quoteOut, _settleTokens(o, address(curve), tokensBefore));
    }

    /// @notice Fills a sell order's take-profit or stop-loss leg in a Goton v4 pool.
    // slither-disable-next-line unused-return (output measured as this contract's balance change; see docs/audit/AUDIT-VERIFICATION.md)
    function executeSellOnPool(uint256 id, PoolKey calldata key, Leg leg) external nonReentrant {
        Order memory o = _open(id, false);
        bool quoteIs0 = _checkPool(key, o.token);
        if (leg == Leg.StopLoss) _checkPoolStop(key, quoteIs0, o.slPriceX36);
        delete orders[id];
        uint256 tokensBefore = IERC20LO(o.token).balanceOf(address(this));
        _approve(o.token, address(router), o.amount);
        uint256 quoteBefore = _quoteBalance();
        router.swapExactIn(key, !quoteIs0, o.amount, 0, address(this), block.timestamp);
        uint256 quoteOut = _quoteBalance() - quoteBefore;
        _finishSell(id, o, leg, quoteOut, _settleTokens(o, address(router), tokensBefore));
    }

    // ---------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------

    /**
     * @notice Token price at a v4 tick as quote raw units per token raw unit, times 1e36.
     * @param quoteIs0 True when the quote is currency0 (the pool price is tokens per quote).
     */
    // slither-disable-next-line divide-before-multiply (squares a 1e18-scaled square root to reach 1e36 without overflow; see docs/audit/AUDIT-VERIFICATION.md)
    function priceX36AtTick(int24 tick, bool quoteIs0) public pure returns (uint256) {
        uint256 sqrtP = TickMath.getSqrtPriceAtTick(tick);
        // price(currency1 per currency0) = (sqrtP / 2^96)^2; scaled by 1e36 through a 1e18 square root.
        if (quoteIs0) {
            uint256 q = (Q96 * 1e18) / sqrtP; // sqrt(1 / price) * 1e18
            return q * q;
        }
        uint256 r = (sqrtP * 1e18) / Q96; // sqrt(price) * 1e18
        return r * r;
    }

    // ---------------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------------

    function _store(Order memory o) private returns (uint256 id) {
        id = nextOrderId++;
        orders[id] = o;
        emit OrderCreated(id, o.owner, o.token, o);
    }

    function _open(uint256 id, bool isBuy) private view returns (Order memory o) {
        o = orders[id];
        if (o.owner == address(0) || o.isBuy != isBuy) revert UnknownOrder();
        if (block.timestamp > o.deadline) revert Expired();
    }

    /// @dev The factory's registry is the source of truth; a curve's own getters could be spoofed.
    function _checkCurve(IBondingCurveLO curve, address token) private view {
        if (curveFactory == address(0) || ICurveFactoryLO(curveFactory).curveToToken(address(curve)) != token) {
            revert InvalidRoute();
        }
    }

    /// @return quoteIs0 Whether the quote asset is currency0 of the pool.
    function _checkPool(PoolKey calldata key, address token) private view returns (bool quoteIs0) {
        if (key.hooks != hook) revert InvalidRoute();
        if (key.currency0 == quoteAsset && key.currency1 == token) return true;
        if (key.currency1 == quoteAsset && key.currency0 == token) return false;
        revert InvalidRoute();
    }

    /// @dev Executor fee from a native deposit, rounded to whole quote units the router accepts.
    // slither-disable-next-line divide-before-multiply (rounds the fee down to whole quote units the router accepts; see docs/audit/AUDIT-VERIFICATION.md)
    function _splitNative(uint256 amount) private view returns (uint256 fee, uint256 spend) {
        fee = ((amount / nativeScale) * EXECUTOR_FEE_BPS / BPS) * nativeScale;
        spend = amount - fee;
    }

    // slither-disable-next-line unused-return,incorrect-equality (only the TWAP tick is needed; zero check; see docs/audit/AUDIT-VERIFICATION.md)
    function _checkPoolStop(PoolKey calldata key, bool quoteIs0, uint256 slPriceX36) private view {
        if (slPriceX36 == 0) revert NotTriggered();
        (int24 twapTick,) = IGotonV4HookLO(hook).consultTick(key.toId());
        if (priceX36AtTick(twapTick, quoteIs0) > slPriceX36) revert NotTriggered();
    }

    /**
     * @dev Returns to `owner` any native quote a partially filled swap refunded to this contract.
     * @param expected This contract's native balance had the swap consumed the whole input.
     * @return refunded Amount sent back.
     */
    function _refundPartial(address owner, uint256 expected) private returns (uint256 refunded) {
        refunded = address(this).balance - expected;
        _sendNative(owner, refunded);
    }

    /// @dev Clears the allowance and returns unsold tokens of a partial fill. @return sold
    // slither-disable-next-line reentrancy-balance (only reached from nonReentrant entry points; the order is already deleted; see docs/audit/AUDIT-VERIFICATION.md)
    function _settleTokens(Order memory o, address spender, uint256 tokensBefore) private returns (uint256 sold) {
        _approve(o.token, spender, 0);
        sold = tokensBefore - IERC20LO(o.token).balanceOf(address(this));
        if (sold < o.amount && !IERC20LO(o.token).transfer(o.owner, o.amount - sold)) revert TransferFailed();
    }

    function _approve(address token, address spender, uint256 amount) private {
        if (!IERC20LO(token).approve(spender, amount)) revert TransferFailed();
    }

    function _finishBuy(uint256 id, Order memory o, uint256 fee, uint256 spent, uint256 tokensBefore) private {
        uint256 got = IERC20LO(o.token).balanceOf(o.owner) - tokensBefore;
        if (got < o.minOut) revert InsufficientOutput();
        _sendNative(msg.sender, fee);
        emit OrderFilled(id, msg.sender, BUY_FILL, spent, got, fee);
    }

    // slither-disable-next-line incorrect-equality (a zero floor means the leg does not exist; see docs/audit/AUDIT-VERIFICATION.md)
    function _finishSell(uint256 id, Order memory o, Leg leg, uint256 quoteOut, uint256 sold) private {
        uint256 floor = leg == Leg.TakeProfit ? o.minOut : o.slMinOut;
        if (floor == 0 || quoteOut < floor) revert InsufficientOutput();
        uint256 fee = (quoteOut * EXECUTOR_FEE_BPS) / BPS;
        _sendQuote(o.owner, quoteOut - fee);
        _sendQuote(msg.sender, fee);
        emit OrderFilled(id, msg.sender, uint8(leg), sold, quoteOut, fee);
    }

    function _quoteBalance() private view returns (uint256) {
        return quoteAsset == address(0) ? address(this).balance : IERC20LO(quoteAsset).balanceOf(address(this));
    }

    function _sendQuote(address to, uint256 amount) private {
        if (quoteAsset == address(0)) _sendNative(to, amount);
        else if (amount > 0 && !IERC20LO(quoteAsset).transfer(to, amount)) revert TransferFailed();
    }

    // slither-disable-next-line incorrect-equality (skip zero transfers; see docs/audit/AUDIT-VERIFICATION.md)
    function _sendNative(address to, uint256 amount) private {
        if (amount == 0) return;
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
