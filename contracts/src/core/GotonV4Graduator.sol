// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey, PoolIdLibrary} from "../interfaces/IUniswapV4.sol";
import {IPoolManagerV4, IUnlockCallback, ModifyLiquidityParams} from "../interfaces/external/IUniswapV4Core.sol";
import {TickMath} from "../libraries/v4/TickMath.sol";
import {V4Lib} from "../libraries/v4/V4Lib.sol";
import {GotonV4Hook} from "./GotonV4Hook.sol";
import {GotonFeeSplitter, GotonFeeSplitterDeployer} from "./GotonFeeSplitter.sol";

interface IERC20Graduation {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IGraduationToken {
    function publicTradingStarted() external view returns (bool);
}

interface ILauncherLaunches {
    function launches(address token)
        external
        view
        returns (address token_, address curve, address creator, uint256 createdAt, bool graduated);
}

/**
 * @title GotonV4Graduator
 * @notice Trustless graduation of a bonding curve into a native-ETH / token Uniswap v4 pool.
 *         Replaces the custodial `migrateCurve(curve, recipient)` flow:
 *
 *   1. The launcher (bonding-curve factory) forwards the curve's ETH and tokens here and calls
 *      `graduate` in the same transaction (graduation itself is permissionless on the factory).
 *   2. The pool is initialized at the curve's final spot price. Initialization is gated by
 *      GotonV4Hook, so nobody can front-run it at a manipulated price.
 *   3. All ETH plus the matching tokens become a full-range position. Tokens the ETH cannot pair
 *      with (the curve's virtual ETH reserve is not real ETH) become a token-only position just
 *      below the current tick: price is continuous at graduation and nothing is burned.
 *   4. Positions are owned by this contract, which has no way to remove liquidity (locked
 *      forever). `collectFees` sends ETH fees to the token's GotonFeeSplitter and burns token fees.
 */
contract GotonV4Graduator is IUnlockCallback {
    using PoolIdLibrary for PoolKey;

    uint24 public constant POOL_FEE = 10_000;
    int24 public constant TICK_SPACING = 200;
    int24 public constant MAX_USABLE_TICK = 887_200;
    /// @notice Hard cap on the protocol's cut of each graduated token's fees (30%).
    uint16 public constant MAX_PROTOCOL_BPS = 3_000;
    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;

    bytes32 private constant MAIN_SALT = bytes32(0);
    bytes32 private constant TOKEN_RESERVE_SALT = bytes32(uint256(1));
    bytes32 private constant ETH_RESERVE_SALT = bytes32(uint256(2));

    struct Graduation {
        address splitter;
        int24 tokenReserveTickUpper; // 0 when no token-only position exists
        int24 ethReserveTickLower; // 0 when no ETH-only position exists
    }

    IPoolManagerV4 public immutable poolManager;
    GotonV4Hook public immutable hook;
    GotonFeeSplitterDeployer public immutable splitterDeployer;

    address public launcher;
    address public owner;
    address public pendingOwner;
    address payable public protocolFeeRecipient;
    address public buybackVault;
    address public liquidityVault;
    GotonFeeSplitter.Split public defaultSplit;

    mapping(address => Graduation) public graduations;
    /// @notice Creator-chosen split of the post-protocol remainder, fixed before public trading.
    mapping(address => GotonFeeSplitter.Split) public tokenSplits;
    mapping(address => bool) public hasTokenSplit;

    bool private _locked;

    enum Action {
        Graduate,
        CollectFees
    }

    event Graduated(
        address indexed token,
        bytes32 indexed poolId,
        address splitter,
        uint256 ethLiquidity,
        uint256 tokenLiquidity,
        uint256 tokenReserve
    );
    event FeesCollected(address indexed token, uint256 ethFees, uint256 tokenFeesBurned);
    event LauncherSet(address indexed launcher);
    event RecipientsUpdated(address protocolFeeRecipient, address buybackVault, address liquidityVault);
    event TokenSplitSet(address indexed token, uint16 holdersBps, uint16 burnBps, uint16 creatorBps, uint16 liquidityBps);
    event DefaultSplitUpdated(uint16 protocolBps, uint16 holdersBps, uint16 burnBps, uint16 creatorBps, uint16 liquidityBps);
    event OwnershipTransferProposed(address indexed proposed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error Unauthorized();
    error ZeroAddress();
    error AlreadyGraduated();
    error UnknownToken();
    error InvalidSplit();
    error LauncherAlreadySet();
    error SplitLocked();
    error TransferFailed();
    error Reentrancy();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (_locked) revert Reentrancy();
        _locked = true;
        _;
        _locked = false;
    }

    constructor(
        IPoolManagerV4 _poolManager,
        GotonV4Hook _hook,
        GotonFeeSplitterDeployer _splitterDeployer,
        address payable _feeRecipient,
        GotonFeeSplitter.Split memory _defaultSplit
    ) {
        if (
            address(_poolManager) == address(0) || address(_hook) == address(0)
                || address(_splitterDeployer) == address(0) || _feeRecipient == address(0)
        ) revert ZeroAddress();
        poolManager = _poolManager;
        hook = _hook;
        splitterDeployer = _splitterDeployer;
        protocolFeeRecipient = _feeRecipient;
        buybackVault = _feeRecipient;
        liquidityVault = _feeRecipient;
        _setDefaultSplit(_defaultSplit);
        owner = msg.sender;
    }

    /// @notice Accepts the curve's ETH and native fees taken from the PoolManager.
    receive() external payable {}

    /// @notice One-time wiring of the bonding-curve factory allowed to graduate tokens.
    function setLauncher(address _launcher) external onlyOwner {
        if (launcher != address(0)) revert LauncherAlreadySet();
        if (_launcher == address(0)) revert ZeroAddress();
        launcher = _launcher;
        emit LauncherSet(_launcher);
    }

    // ---------------------------------------------------------------------------
    // Per-token revenue split
    // ---------------------------------------------------------------------------

    /**
     * @notice Lets a token's creator choose how the post-protocol share of its LP fees is split
     *         (holders / burn / creator / liquidity). Settable once, and only before any third
     *         party has bought, so buyers always see the split they trade under. The protocol cut
     *         is the graduator default at graduation time.
     */
    // slither-disable-next-line unused-return (unused tuple fields; see docs/audit/AUDIT-VERIFICATION.md)
    function setRevenueSplit(address token, uint16 holdersBps, uint16 burnBps, uint16 creatorBps, uint16 liquidityBps)
        external
    {
        (,, address creator,,) = ILauncherLaunches(launcher).launches(token);
        if (creator == address(0) || msg.sender != creator) revert Unauthorized();
        _setRevenueSplit(token, holdersBps, burnBps, creatorBps, liquidityBps);
    }

    /// @notice The launcher records the creator's split inside the launch transaction, before any
    ///         buyer can lock it to the default by trading first. Same rules as setRevenueSplit.
    function setRevenueSplitByLauncher(
        address token,
        uint16 holdersBps,
        uint16 burnBps,
        uint16 creatorBps,
        uint16 liquidityBps
    ) external {
        if (msg.sender != launcher) revert Unauthorized();
        _setRevenueSplit(token, holdersBps, burnBps, creatorBps, liquidityBps);
    }

    function _setRevenueSplit(address token, uint16 holdersBps, uint16 burnBps, uint16 creatorBps, uint16 liquidityBps)
        private
    {
        if (
            hasTokenSplit[token] || graduations[token].splitter != address(0)
                || IGraduationToken(token).publicTradingStarted()
        ) revert SplitLocked();
        if (uint256(holdersBps) + burnBps + creatorBps + liquidityBps != 10_000) revert InvalidSplit();
        tokenSplits[token] = GotonFeeSplitter.Split({
            protocolBps: 0, // replaced by the default protocol cut at graduation
            holdersBps: holdersBps,
            burnBps: burnBps,
            creatorBps: creatorBps,
            liquidityBps: liquidityBps
        });
        hasTokenSplit[token] = true;
        emit TokenSplitSet(token, holdersBps, burnBps, creatorBps, liquidityBps);
    }

    function _splitFor(address token) private view returns (GotonFeeSplitter.Split memory split) {
        if (!hasTokenSplit[token]) return defaultSplit;
        split = tokenSplits[token];
        split.protocolBps = defaultSplit.protocolBps;
    }

    // ---------------------------------------------------------------------------
    // Graduation
    // ---------------------------------------------------------------------------

    /**
     * @notice Seeds the token's v4 pool with every wei of ETH and token this contract holds.
     * @param token Graduating token (currency1; native ETH is always currency0).
     * @param creator Token creator (splitter creator share).
     * @param curve Bonding curve, excluded from dividend circulating supply.
     * @param sqrtPriceX96 Curve's final spot price (token per ETH, Q64.96).
     */
    // slither-disable-next-line reentrancy-no-eth,unused-return (guarded by nonReentrant / onlyPoolManager / trusted caller; unused tuple fields; see docs/audit/AUDIT-VERIFICATION.md)
    function graduate(address token, address creator, address curve, uint160 sqrtPriceX96)
        external
        nonReentrant
        returns (bytes32 poolId, address splitter)
    {
        if (msg.sender != launcher) revert Unauthorized();
        if (graduations[token].splitter != address(0)) revert AlreadyGraduated();

        splitter = splitterDeployer.deploy(
            GotonFeeSplitter.Config({
                token: token,
                quoteAsset: address(0),
                hook: address(hook),
                factory: address(this),
                poolManager: address(poolManager),
                excluded: curve,
                treasury: protocolFeeRecipient,
                buybackVault: buybackVault,
                liquidityVault: liquidityVault,
                creator: creator
            }),
            _splitFor(token)
        );
        graduations[token].splitter = splitter;

        PoolKey memory key = _poolKey(token);
        poolId = key.toId();
        hook.registerPool(
            key,
            GotonV4Hook.PoolRegistration({
                token: token,
                splitter: splitter,
                buyTaxBps: 0,
                sellTaxBps: 0,
                bondTick: 0,
                bonded: false,
                antiSnipe: false
            })
        );
        poolManager.initialize(key, sqrtPriceX96);

        uint256 tokensIn = IERC20Graduation(token).balanceOf(address(this));
        (uint256 ethUsed, uint256 tokensUsed) =
            abi.decode(poolManager.unlock(abi.encode(Action.Graduate, abi.encode(key))), (uint256, uint256));

        // Rounding dust: tokens are burned, ETH goes to the protocol.
        uint256 tokenDust = IERC20Graduation(token).balanceOf(address(this));
        // slither-disable-next-line reentrancy-balance (burning our own token dust; nothing reads the balance afterwards)
        if (tokenDust > 0 && !IERC20Graduation(token).transfer(DEAD, tokenDust)) revert TransferFailed();
        uint256 ethDust = address(this).balance;
        if (ethDust > 0) {
            (bool ok,) = protocolFeeRecipient.call{value: ethDust}("");
            if (!ok) revert TransferFailed();
        }

        emit Graduated(token, poolId, splitter, ethUsed, tokensUsed, tokensIn - tokensUsed - tokenDust);
    }

    /**
     * @notice Collects LP fees from the token's locked positions. Callable by anyone: ETH fees
     *         are split by the token's GotonFeeSplitter (holder dividends stream over a day),
     *         token fees are burned.
     */
    function collectFees(address token) external nonReentrant returns (uint256 ethFees, uint256 tokenFees) {
        Graduation memory g = graduations[token];
        if (g.splitter == address(0)) revert UnknownToken();
        (ethFees, tokenFees) =
            abi.decode(poolManager.unlock(abi.encode(Action.CollectFees, abi.encode(token))), (uint256, uint256));
        if (ethFees > 0) GotonFeeSplitter(payable(g.splitter)).distributeFees(ethFees);
        emit FeesCollected(token, ethFees, tokenFees);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert Unauthorized();
        (Action action, bytes memory payload) = abi.decode(data, (Action, bytes));
        if (action == Action.Graduate) return _graduateCallback(abi.decode(payload, (PoolKey)));
        return _collectCallback(abi.decode(payload, (address)));
    }

    // slither-disable-next-line divide-before-multiply,reentrancy-eth (external calls go to the PoolManager and the launchpad token only; graduate() is launcher-only) (intentional rounding; see docs/audit/AUDIT-VERIFICATION.md)
    function _graduateCallback(PoolKey memory key) private returns (bytes memory) {
        address token = key.currency1;
        (uint160 sqrtPrice, int24 tick) = V4Lib.getSlot0(poolManager, key.toId());
        uint160 sqrtMin = TickMath.getSqrtPriceAtTick(-MAX_USABLE_TICK);
        uint160 sqrtMax = TickMath.getSqrtPriceAtTick(MAX_USABLE_TICK);

        // 1. Full-range position with all ETH and the tokens it pairs with at the current price.
        uint256 ethBalance = address(this).balance;
        uint256 tokenBalance = IERC20Graduation(token).balanceOf(address(this));
        uint128 fromEth = V4Lib.liquidityForAmount0(sqrtPrice, sqrtMax, ethBalance);
        uint128 fromTokens = V4Lib.liquidityForAmount1(sqrtMin, sqrtPrice, tokenBalance);
        (uint256 ethUsed, uint256 tokensUsed) = _addLiquidity(
            key, -MAX_USABLE_TICK, MAX_USABLE_TICK, fromEth < fromTokens ? fromEth : fromTokens, MAIN_SALT
        );

        // 2. Unpaired remainder as a single-sided position just outside the current price.
        uint256 tokensLeft = tokenBalance - tokensUsed;
        uint256 ethLeft = ethBalance - ethUsed;
        int24 compressed = tick / TICK_SPACING;
        if (tick < 0 && tick % TICK_SPACING != 0) compressed--;
        int24 floorTick = compressed * TICK_SPACING;

        if (tokensLeft > 0 && floorTick > -MAX_USABLE_TICK) {
            uint128 liquidity =
                V4Lib.liquidityForAmount1(sqrtMin, TickMath.getSqrtPriceAtTick(floorTick), tokensLeft);
            if (liquidity > 0) {
                (, uint256 used) = _addLiquidity(key, -MAX_USABLE_TICK, floorTick, liquidity, TOKEN_RESERVE_SALT);
                tokensUsed += used;
                graduations[token].tokenReserveTickUpper = floorTick;
            }
        }
        int24 ceilTick = floorTick + TICK_SPACING;
        if (ethLeft > 0 && ceilTick < MAX_USABLE_TICK) {
            uint128 liquidity = V4Lib.liquidityForAmount0(TickMath.getSqrtPriceAtTick(ceilTick), sqrtMax, ethLeft);
            if (liquidity > 0) {
                (uint256 used,) = _addLiquidity(key, ceilTick, MAX_USABLE_TICK, liquidity, ETH_RESERVE_SALT);
                ethUsed += used;
                graduations[token].ethReserveTickLower = ceilTick;
            }
        }
        return abi.encode(ethUsed, tokensUsed);
    }

    // slither-disable-next-line unused-return (unused tuple fields; see docs/audit/AUDIT-VERIFICATION.md)
    function _addLiquidity(PoolKey memory key, int24 tickLower, int24 tickUpper, uint128 liquidity, bytes32 salt)
        private
        returns (uint256 ethPaid, uint256 tokensPaid)
    {
        (int256 delta,) = poolManager.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidityDelta: int256(uint256(liquidity)),
                salt: salt
            }),
            ""
        );
        ethPaid = V4Lib.abs(V4Lib.amount0(delta));
        tokensPaid = V4Lib.abs(V4Lib.amount1(delta));
        if (ethPaid > 0) poolManager.settle{value: ethPaid}();
        if (tokensPaid > 0) {
            poolManager.sync(key.currency1);
            if (!IERC20Graduation(key.currency1).transfer(address(poolManager), tokensPaid)) revert TransferFailed();
            poolManager.settle();
        }
    }

    function _collectCallback(address token) private returns (bytes memory) {
        Graduation memory g = graduations[token];
        PoolKey memory key = _poolKey(token);
        (uint256 eth, uint256 tokens) = _poke(key, -MAX_USABLE_TICK, MAX_USABLE_TICK, MAIN_SALT);
        if (g.tokenReserveTickUpper != 0) {
            (uint256 e, uint256 t) = _poke(key, -MAX_USABLE_TICK, g.tokenReserveTickUpper, TOKEN_RESERVE_SALT);
            eth += e;
            tokens += t;
        }
        if (g.ethReserveTickLower != 0) {
            (uint256 e, uint256 t) = _poke(key, g.ethReserveTickLower, MAX_USABLE_TICK, ETH_RESERVE_SALT);
            eth += e;
            tokens += t;
        }
        if (eth > 0) poolManager.take(address(0), g.splitter, eth);
        if (tokens > 0) poolManager.take(token, DEAD, tokens);
        return abi.encode(eth, tokens);
    }

    /// @dev Zero-liquidity modification credits accrued fees to this contract.
    // slither-disable-next-line unused-return (unused tuple fields; see docs/audit/AUDIT-VERIFICATION.md)
    function _poke(PoolKey memory key, int24 tickLower, int24 tickUpper, bytes32 salt)
        private
        returns (uint256 eth, uint256 tokens)
    {
        (int256 delta,) = poolManager.modifyLiquidity(
            key, ModifyLiquidityParams({tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: 0, salt: salt}), ""
        );
        eth = uint256(int256(V4Lib.amount0(delta)));
        tokens = uint256(int256(V4Lib.amount1(delta)));
    }

    // ---------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------

    function poolKeyOf(address token) external view returns (PoolKey memory) {
        return _poolKey(token);
    }

    function _poolKey(address token) private view returns (PoolKey memory) {
        return PoolKey({
            currency0: address(0),
            currency1: token,
            fee: POOL_FEE,
            tickSpacing: TICK_SPACING,
            hooks: address(hook)
        });
    }

    // ---------------------------------------------------------------------------
    // Admin (affects future graduations only)
    // ---------------------------------------------------------------------------

    function setRecipients(address payable _protocolFeeRecipient, address _buybackVault, address _liquidityVault)
        external
        onlyOwner
    {
        if (_protocolFeeRecipient == address(0) || _buybackVault == address(0) || _liquidityVault == address(0)) {
            revert ZeroAddress();
        }
        protocolFeeRecipient = _protocolFeeRecipient;
        buybackVault = _buybackVault;
        liquidityVault = _liquidityVault;
        emit RecipientsUpdated(_protocolFeeRecipient, _buybackVault, _liquidityVault);
    }

    function setDefaultSplit(GotonFeeSplitter.Split calldata split) external onlyOwner {
        _setDefaultSplit(split);
    }

    function _setDefaultSplit(GotonFeeSplitter.Split memory split) private {
        if (
            split.protocolBps > MAX_PROTOCOL_BPS
                || uint256(split.holdersBps) + split.burnBps + split.creatorBps + split.liquidityBps != 10_000
        ) revert InvalidSplit();
        defaultSplit = split;
        emit DefaultSplitUpdated(split.protocolBps, split.holdersBps, split.burnBps, split.creatorBps, split.liquidityBps);
    }

    function transferOwnership(address newOwner) external onlyOwner {
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
