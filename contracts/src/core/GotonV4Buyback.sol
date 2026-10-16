// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey, PoolIdLibrary} from "../interfaces/IUniswapV4.sol";
import {IPoolManagerV4, IUnlockCallback, SwapParams} from "../interfaces/external/IUniswapV4Core.sol";
import {TickMath} from "../libraries/v4/TickMath.sol";
import {V4Lib} from "../libraries/v4/V4Lib.sol";
import {GotonV4Hook} from "./GotonV4Hook.sol";

interface IBuybackSource {
    function releaseBuyback() external returns (uint256 amount);
}

interface IERC20Buyback {
    function transfer(address to, uint256 amount) external returns (bool);
}

/**
 * @title GotonV4Buyback
 * @notice Chain-wide buyback-and-burn for Goton v4 pools (AUD-HIGH-05 / TKT-06).
 *
 *   - Each token's GotonFeeSplitter accrues its burn share; `buyback(key)` pulls it (per-token
 *     accounting in `pending`), buys the token in its own pool and sends the tokens to 0xdEaD.
 *   - Callable by anyone (e.g. a keeper). The swap carries a sqrtPriceLimit at the hook's TWAP
 *     ± `maxDeviationTicks`, so a manipulated spot price can only make the swap stop early; the
 *     unspent quote stays pending for the next call. No caller-supplied minimum is trusted.
 */
contract GotonV4Buyback is IUnlockCallback {
    using PoolIdLibrary for PoolKey;

    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;
    int24 public constant MIN_DEVIATION_TICKS = 10;
    int24 public constant MAX_DEVIATION_TICKS = 2_000;

    IPoolManagerV4 public immutable poolManager;
    GotonV4Hook public immutable hook;

    address public owner;
    address public pendingOwner;
    /// @notice Allowed distance from the TWAP tick (200 ≈ 2%).
    int24 public maxDeviationTicks = 200;

    /// @notice Quote currency released by a token's splitter but not yet spent.
    mapping(address => uint256) public pending;

    bool private _locked;

    struct SwapRequest {
        PoolKey key;
        bool zeroForOne;
        address quote;
        address token;
        uint256 amount;
        uint160 sqrtPriceLimitX96;
    }

    event BuybackExecuted(address indexed token, uint256 quoteSpent, uint256 tokensBurned, int24 twapTick);
    event BuybackSkipped(address indexed token, uint256 pendingQuote, int24 twapTick);
    event MaxDeviationUpdated(int24 ticks);
    event OwnershipTransferProposed(address indexed proposed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error Unauthorized();
    error UnknownPool();
    error InvalidDeviation();
    error TransferFailed();
    error Reentrancy();
    error ZeroAddress();

    modifier nonReentrant() {
        if (_locked) revert Reentrancy();
        _locked = true;
        _;
        _locked = false;
    }

    constructor(IPoolManagerV4 _poolManager, GotonV4Hook _hook) {
        if (address(_poolManager) == address(0) || address(_hook) == address(0)) revert ZeroAddress();
        poolManager = _poolManager;
        hook = _hook;
        owner = msg.sender;
    }

    /// @notice Receives native-quote burn shares released by splitters.
    receive() external payable {}

    /**
     * @notice Pulls the token's accrued burn share and buys-and-burns as much as the TWAP guard allows.
     * @return spent Quote spent in this call.
     * @return burned Tokens sent to 0xdEaD.
     */
    function buyback(PoolKey calldata key) external nonReentrant returns (uint256 spent, uint256 burned) {
        if (key.hooks != address(hook)) revert UnknownPool();
        bytes32 id = key.toId();
        (address token, address quote, address splitter,,,, bool quoteIsCurrency0,,,) = hook.pools(id);
        if (token == address(0)) revert UnknownPool();

        uint256 amount = pending[token] + IBuybackSource(splitter).releaseBuyback();
        pending[token] = amount;
        if (amount == 0) return (0, 0);

        (int24 twapTick,) = hook.consultTick(id);
        // Buying the token pushes price towards lower ticks when the quote is currency0, higher otherwise.
        int24 limitTick = quoteIsCurrency0 ? twapTick - maxDeviationTicks : twapTick + maxDeviationTicks;
        if (limitTick <= TickMath.MIN_TICK) limitTick = TickMath.MIN_TICK + 1;
        if (limitTick >= TickMath.MAX_TICK) limitTick = TickMath.MAX_TICK - 1;
        uint160 sqrtLimit = TickMath.getSqrtPriceAtTick(limitTick);

        (uint160 sqrtNow,) = V4Lib.getSlot0(poolManager, id);
        if (quoteIsCurrency0 ? sqrtNow <= sqrtLimit : sqrtNow >= sqrtLimit) {
            // Spot is already beyond the guard (e.g. manipulated): keep the funds for later.
            emit BuybackSkipped(token, amount, twapTick);
            return (0, 0);
        }

        (spent, burned) = abi.decode(
            poolManager.unlock(
                abi.encode(
                    SwapRequest({
                        key: key,
                        zeroForOne: quoteIsCurrency0,
                        quote: quote,
                        token: token,
                        amount: amount,
                        sqrtPriceLimitX96: sqrtLimit
                    })
                )
            ),
            (uint256, uint256)
        );
        pending[token] = amount - spent;
        emit BuybackExecuted(token, spent, burned, twapTick);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert Unauthorized();
        SwapRequest memory r = abi.decode(data, (SwapRequest));

        int256 delta = poolManager.swap(
            r.key,
            SwapParams({
                zeroForOne: r.zeroForOne,
                amountSpecified: -int256(r.amount),
                sqrtPriceLimitX96: r.sqrtPriceLimitX96
            }),
            ""
        );
        uint256 spent = V4Lib.abs(r.zeroForOne ? V4Lib.amount0(delta) : V4Lib.amount1(delta));
        uint256 bought = V4Lib.abs(r.zeroForOne ? V4Lib.amount1(delta) : V4Lib.amount0(delta));

        if (spent > 0) {
            if (r.quote == address(0)) {
                poolManager.settle{value: spent}();
            } else {
                poolManager.sync(r.quote);
                if (!IERC20Buyback(r.quote).transfer(address(poolManager), spent)) revert TransferFailed();
                poolManager.settle();
            }
        }
        if (bought > 0) poolManager.take(r.token, DEAD, bought);
        return abi.encode(spent, bought);
    }

    // ---------------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------------

    function setMaxDeviationTicks(int24 ticks) external {
        if (msg.sender != owner) revert Unauthorized();
        if (ticks < MIN_DEVIATION_TICKS || ticks > MAX_DEVIATION_TICKS) revert InvalidDeviation();
        maxDeviationTicks = ticks;
        emit MaxDeviationUpdated(ticks);
    }

    function transferOwnership(address newOwner) external {
        if (msg.sender != owner) revert Unauthorized();
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferProposed(newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert Unauthorized();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }
}
