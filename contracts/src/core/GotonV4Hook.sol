// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey, PoolIdLibrary} from "../interfaces/IUniswapV4.sol";
import {IPoolManagerV4, IUnlockCallback, SwapParams} from "../interfaces/external/IUniswapV4Core.sol";
import {V4Lib} from "../libraries/v4/V4Lib.sol";
import {AntiSnipeLogic} from "../libraries/AntiSnipeLogic.sol";

/// @dev beforeInitialize | beforeSwap | afterSwap | beforeSwapReturnsDelta | afterSwapReturnsDelta.
uint160 constant PROTO_V4_HOOK_FLAGS = (1 << 13) | (1 << 7) | (1 << 6) | (1 << 3) | (1 << 2); // 0x20CC

interface IFeeSplitter {
    function distributeFees(uint256 amount) external;
}

/**
 * @title GotonV4Hook
 * @notice Chain-agnostic singleton Uniswap v4 hook for every Goton pool on a chain.
 *         - Restricts pool initialization to the registered launcher (factory / graduator).
 *         - Charges each pool's fixed buy/sell tax (optionally raised to a decaying anti-snipe
 *           tax) in the quote currency — native ETH or an ERC-20 such as Arc USDC — as ERC-6909
 *           claims on the PoolManager during the swap; `flushTaxes` (anyone, e.g. a keeper) later
 *           pays them to the token's GotonFeeSplitter. Swaps never move tokens out of the
 *           PoolManager mid-swap, so they work for any quote currency.
 *         - Can be paused by the deployer or a guardian for at most PAUSE_MAX; swaps revert while
 *           paused, and the pause lapses on its own so funds can never be frozen indefinitely.
 *         - Tracks in-pool graduation: `bonded` flips to false once price crosses `bondTick`.
 *         - Keeps a tick accumulator per pool plus a ring of snapshots (at most one per
 *           SNAPSHOT_SPACING), so `consultTick` returns the TWAP over the last ORACLE_PERIOD (up to
 *           SNAPSHOT_SPACING more) however rarely the pool trades. It guards protocol buybacks and
 *           stop-losses against one-block price pushes.
 *
 *         The hook address's low 14 bits must equal PROTO_V4_HOOK_FLAGS (mined via CREATE2).
 */
contract GotonV4Hook is IUnlockCallback {
    using PoolIdLibrary for PoolKey;

    uint160 public constant FLAGS = PROTO_V4_HOOK_FLAGS;
    uint160 private constant ALL_HOOK_MASK = (1 << 14) - 1;
    uint256 private constant BPS = 10_000;

    struct PoolConfig {
        address token;
        address quote;
        address splitter;
        uint16 buyTaxBps;
        uint16 sellTaxBps;
        int24 bondTick;
        bool quoteIsCurrency0;
        bool bonded;
        bool antiSnipe;
        uint64 launchTime;
    }

    struct PoolRegistration {
        address token;
        address splitter;
        uint16 buyTaxBps;
        uint16 sellTaxBps;
        /// @dev Oriented to the pool's currency order; ignored when `bonded` is false.
        int24 bondTick;
        bool bonded;
        bool antiSnipe;
    }

    IPoolManagerV4 public immutable poolManager;
    address public immutable deployer;
    /// @notice The only contract allowed to register and initialize pools (factory or graduator).
    address public factory;

    /// @dev Tick accumulator (one slot) and the ring of snapshots it feeds.
    struct Oracle {
        int56 tickCumulative;
        uint32 lastTimestamp; // the last swap
        uint32 startTimestamp; // the first swap: the accumulator is 0 there
        uint32 lastSnapshotTimestamp;
        uint8 next; // ring slot the next snapshot goes to
        uint8 count;
    }

    /// @dev One slot. `prevTick` held from `prevSwapTimestamp` until `timestamp` (no swap between).
    struct Snapshot {
        uint32 timestamp;
        int56 tickCumulative;
        int24 prevTick;
        uint32 prevSwapTimestamp;
    }

    uint32 public constant ORACLE_PERIOD = 30 minutes;
    uint32 public constant SNAPSHOT_SPACING = 60;
    /// @dev 64 snapshots at least SNAPSHOT_SPACING apart reach back over 64 minutes.
    uint256 private constant SNAPSHOTS = 64;
    uint256 public constant PAUSE_MAX = 3 days;

    mapping(bytes32 => PoolConfig) public pools;
    mapping(bytes32 => Oracle) public oracles;
    mapping(bytes32 => Snapshot[SNAPSHOTS]) private _snapshots;
    /// @notice Tax a pool has collected as PoolManager claims and not yet paid to its splitter.
    mapping(bytes32 => uint256) public pendingTax;

    address public guardian;
    /// @notice Swaps revert until this time (0: not paused).
    uint256 public pausedUntil;
    bool private _flushing;

    event FactorySet(address indexed factory);
    event PoolRegistered(
        bytes32 indexed poolId, address indexed token, address splitter, uint16 buyTaxBps, uint16 sellTaxBps
    );
    event TaxCollected(bytes32 indexed poolId, bool isBuy, uint256 amount);
    event BondGraduated(bytes32 indexed poolId, int24 tick);
    event TaxesFlushed(bytes32 indexed poolId, address indexed splitter, uint256 amount);
    event GuardianSet(address indexed guardian);
    event SwapsPaused(uint256 until);
    event SwapsUnpaused();

    error Unauthorized();
    error ZeroAddress();
    error InvalidHookAddress();
    error PoolNotRegistered();
    error PoolAlreadyRegistered();
    error FactoryAlreadySet();
    error OracleNotReady();
    error Paused();

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert Unauthorized();
        _;
    }

    constructor(IPoolManagerV4 _poolManager, address _deployer) {
        if (address(_poolManager) == address(0) || _deployer == address(0)) revert ZeroAddress();
        if (uint160(address(this)) & ALL_HOOK_MASK != FLAGS) revert InvalidHookAddress();
        poolManager = _poolManager;
        deployer = _deployer;
    }

    /// @notice One-time wiring of the launcher (the hook must exist before it is deployed).
    function setFactory(address _factory) external {
        if (msg.sender != deployer) revert Unauthorized();
        if (factory != address(0)) revert FactoryAlreadySet();
        if (_factory == address(0)) revert ZeroAddress();
        factory = _factory;
        emit FactorySet(_factory);
    }

    function setGuardian(address newGuardian) external {
        if (msg.sender != deployer) revert Unauthorized();
        guardian = newGuardian;
        emit GuardianSet(newGuardian);
    }

    /// @notice Stops every Goton pool's swaps for PAUSE_MAX at most (incident response).
    function pause() external {
        if (msg.sender != deployer && msg.sender != guardian) revert Unauthorized();
        pausedUntil = block.timestamp + PAUSE_MAX;
        emit SwapsPaused(pausedUntil);
    }

    function unpause() external {
        if (msg.sender != deployer) revert Unauthorized();
        pausedUntil = 0;
        emit SwapsUnpaused();
    }

    function registerPool(PoolKey calldata key, PoolRegistration calldata reg) external {
        if (msg.sender != factory) revert Unauthorized();
        if (key.hooks != address(this) || reg.token == address(0) || reg.splitter == address(0)) revert ZeroAddress();
        bytes32 id = key.toId();
        if (pools[id].token != address(0)) revert PoolAlreadyRegistered();
        bool quoteIsCurrency0 = key.currency1 == reg.token;
        pools[id] = PoolConfig({
            token: reg.token,
            quote: quoteIsCurrency0 ? key.currency0 : key.currency1,
            splitter: reg.splitter,
            buyTaxBps: reg.buyTaxBps,
            sellTaxBps: reg.sellTaxBps,
            bondTick: reg.bondTick,
            quoteIsCurrency0: quoteIsCurrency0,
            bonded: reg.bonded,
            antiSnipe: reg.antiSnipe,
            launchTime: uint64(block.timestamp)
        });
        emit PoolRegistered(id, reg.token, reg.splitter, reg.buyTaxBps, reg.sellTaxBps);
    }

    // ---------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------

    function bonded(bytes32 poolId) external view returns (bool) {
        return pools[poolId].bonded;
    }

    function currentSnipeTaxBps(bytes32 poolId) public view returns (uint256) {
        PoolConfig storage cfg = pools[poolId];
        if (!cfg.antiSnipe) return 0;
        return AntiSnipeLogic.calculateSnipeTaxBps(cfg.launchTime, block.timestamp);
    }

    function currentTaxBps(bytes32 poolId, bool isBuy) external view returns (uint256) {
        return _taxBps(pools[poolId], poolId, isBuy, address(0));
    }

    // ---------------------------------------------------------------------------
    // Hook callbacks
    // ---------------------------------------------------------------------------

    function beforeInitialize(address sender, PoolKey calldata key, uint160)
        external
        view
        onlyPoolManager
        returns (bytes4)
    {
        if (sender != factory) revert Unauthorized();
        if (pools[key.toId()].token == address(0)) revert PoolNotRegistered();
        return this.beforeInitialize.selector;
    }

    /// @dev Taxes the specified amount when the user specified the quote side (exact-in buy, exact-out sell).
    function beforeSwap(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata)
        external
        onlyPoolManager
        returns (bytes4, int256, uint24)
    {
        bytes32 id = key.toId();
        PoolConfig storage cfg = pools[id];
        if (cfg.token == address(0)) revert PoolNotRegistered();
        if (block.timestamp < pausedUntil) revert Paused();
        _writeOracle(id);

        if (_specifiedIsQuote(cfg, params)) {
            bool isBuy = params.zeroForOne == cfg.quoteIsCurrency0;
            uint256 tax = (V4Lib.abs(params.amountSpecified) * _taxBps(cfg, id, isBuy, sender)) / BPS;
            if (tax > 0) {
                _collect(cfg, id, isBuy, tax);
                return (this.beforeSwap.selector, V4Lib.toBeforeSwapDelta(int128(int256(tax))), 0);
            }
        }
        return (this.beforeSwap.selector, 0, 0);
    }

    /// @dev Taxes the quote leg when it is the unspecified side (exact-in sell, exact-out buy), then checks graduation.
    // slither-disable-next-line reentrancy-no-eth,unused-return (guarded by nonReentrant / onlyPoolManager / trusted caller; unused tuple fields; see docs/audit/AUDIT-VERIFICATION.md)
    function afterSwap(address sender, PoolKey calldata key, SwapParams calldata params, int256 delta, bytes calldata)
        external
        onlyPoolManager
        returns (bytes4, int128 hookDelta)
    {
        bytes32 id = key.toId();
        PoolConfig storage cfg = pools[id];

        if (!_specifiedIsQuote(cfg, params)) {
            bool isBuy = params.zeroForOne == cfg.quoteIsCurrency0;
            int128 quoteDelta = cfg.quoteIsCurrency0 ? V4Lib.amount0(delta) : V4Lib.amount1(delta);
            uint256 tax = (V4Lib.abs(quoteDelta) * _taxBps(cfg, id, isBuy, sender)) / BPS;
            if (tax > 0) {
                _collect(cfg, id, isBuy, tax);
                hookDelta = int128(int256(tax));
            }
        }

        if (cfg.bonded) {
            (, int24 tick) = V4Lib.getSlot0(poolManager, id);
            if (cfg.quoteIsCurrency0 ? tick <= cfg.bondTick : tick >= cfg.bondTick) {
                cfg.bonded = false;
                emit BondGraduated(id, tick);
            }
        }

        return (this.afterSwap.selector, hookDelta);
    }

    // ---------------------------------------------------------------------------
    // Taxes
    // ---------------------------------------------------------------------------

    /**
     * @notice Pays a pool's collected tax to its splitter, which splits it (protocol, holders,
     *         burn, creator, liquidity). Callable by anyone; keepers call it with collectFees.
     * @return amount Quote paid out.
     */
    function flushTaxes(bytes32 poolId) external returns (uint256 amount) {
        PoolConfig storage cfg = pools[poolId];
        amount = pendingTax[poolId];
        if (amount == 0) return 0;
        pendingTax[poolId] = 0;
        _flushing = true;
        poolManager.unlock(abi.encode(cfg.quote, cfg.splitter, amount));
        _flushing = false;
        IFeeSplitter(cfg.splitter).distributeFees(amount);
        emit TaxesFlushed(poolId, cfg.splitter, amount);
    }

    /// @dev Turns the hook's claims back into the currency, sent straight to the splitter.
    function unlockCallback(bytes calldata data) external onlyPoolManager returns (bytes memory) {
        if (!_flushing) revert Unauthorized();
        (address quote, address splitter, uint256 amount) = abi.decode(data, (address, address, uint256));
        poolManager.burn(address(this), uint256(uint160(quote)), amount);
        poolManager.take(quote, splitter, amount);
        return "";
    }

    // ---------------------------------------------------------------------------
    // TWAP oracle
    // ---------------------------------------------------------------------------

    /**
     * @notice Time-weighted average tick over the last ORACLE_PERIOD, or up to SNAPSHOT_SPACING
     *         longer. With no swap in the period it is the current tick: the price has not moved.
     * @dev Reverts until the pool's first swap is ORACLE_PERIOD old.
     */
    // slither-disable-next-line incorrect-equality,unused-return (exact zero checks; unused tuple fields; see docs/audit/AUDIT-VERIFICATION.md)
    function consultTick(bytes32 poolId) external view returns (int24 twapTick, uint32 window) {
        Oracle memory o = oracles[poolId];
        uint32 nowTs = uint32(block.timestamp);
        if (o.lastTimestamp == 0 || nowTs - o.startTimestamp < ORACLE_PERIOD) revert OracleNotReady();
        (, int24 tick) = V4Lib.getSlot0(poolManager, poolId);
        uint32 target = nowTs - ORACLE_PERIOD;
        // No swap since the window began: the current tick held for all of it.
        if (target >= o.lastTimestamp) return (tick, ORACLE_PERIOD);

        int56 cumulativeNow = o.tickCumulative + int56(tick) * int56(uint56(nowTs - o.lastTimestamp));
        (int56 cumulativeAt, uint32 from) = _cumulativeAt(poolId, o, target);
        window = nowTs - from;
        int56 delta = cumulativeNow - cumulativeAt;
        twapTick = int24(delta / int56(uint56(window)));
        // slither-disable-next-line weak-prng (modulo rounds the TWAP toward -inf; no randomness involved)
        if (delta < 0 && delta % int56(uint56(window)) != 0) twapTick--; // round towards -infinity
    }

    /**
     * @dev The accumulator at `target`, or at the latest point before it that is known exactly (at
     *      most SNAPSHOT_SPACING earlier). Snapshots are in time order in the ring; binary search.
     */
    function _cumulativeAt(bytes32 poolId, Oracle memory o, uint32 target)
        private
        view
        returns (int56 cumulative, uint32 at)
    {
        Snapshot[SNAPSHOTS] storage ring = _snapshots[poolId];
        uint256 oldest = (o.next + SNAPSHOTS - o.count) % SNAPSHOTS;
        // Largest i in [0, count) whose snapshot is at or before target; count when none is.
        uint256 lo = 0;
        uint256 hi = o.count;
        while (lo < hi) {
            uint256 mid = (lo + hi) / 2;
            if (ring[(oldest + mid) % SNAPSHOTS].timestamp <= target) lo = mid + 1;
            else hi = mid;
        }
        // lo = number of snapshots at or before target.
        if (lo < o.count) {
            Snapshot memory after_ = ring[(oldest + lo) % SNAPSHOTS];
            // One tick held from the previous swap until this snapshot: interpolate exactly.
            if (target >= after_.prevSwapTimestamp) {
                return
                    (after_.tickCumulative - int56(after_.prevTick) * int56(uint56(after_.timestamp - target)), target);
            }
        }
        if (lo > 0) {
            Snapshot memory before = ring[(oldest + lo - 1) % SNAPSHOTS];
            return (before.tickCumulative, before.timestamp);
        }
        // Nothing older in the ring: the accumulator started at 0 on the first swap, unless the
        // ring has wrapped past the window (not with SNAPSHOTS * SNAPSHOT_SPACING > ORACLE_PERIOD).
        if (o.count < SNAPSHOTS) return (0, o.startTimestamp);
        revert OracleNotReady();
    }

    /// @dev Accumulates the tick that prevailed since the last swap (read before this swap moves
    ///      it) and, at most once per SNAPSHOT_SPACING, records a snapshot.
    // slither-disable-next-line incorrect-equality,unused-return (exact zero / same-block checks; unused tuple fields; see docs/audit/AUDIT-VERIFICATION.md)
    function _writeOracle(bytes32 id) private {
        Oracle storage o = oracles[id];
        uint32 nowTs = uint32(block.timestamp);
        if (o.lastTimestamp == 0) {
            o.lastTimestamp = nowTs;
            o.startTimestamp = nowTs;
            o.lastSnapshotTimestamp = nowTs;
            return;
        }
        if (nowTs == o.lastTimestamp) return;
        (, int24 tick) = V4Lib.getSlot0(poolManager, id);
        uint32 prevSwap = o.lastTimestamp;
        o.tickCumulative += int56(tick) * int56(uint56(nowTs - prevSwap));
        o.lastTimestamp = nowTs;
        if (nowTs - o.lastSnapshotTimestamp >= SNAPSHOT_SPACING) {
            _snapshots[id][o.next] = Snapshot({
                timestamp: nowTs, tickCumulative: o.tickCumulative, prevTick: tick, prevSwapTimestamp: prevSwap
            });
            o.next = uint8((uint256(o.next) + 1) % SNAPSHOTS);
            if (o.count < SNAPSHOTS) o.count++;
            o.lastSnapshotTimestamp = nowTs;
        }
    }

    // ---------------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------------

    function _specifiedIsQuote(PoolConfig storage cfg, SwapParams calldata params) private view returns (bool) {
        bool specifiedIsCurrency0 = (params.amountSpecified < 0) == params.zeroForOne;
        return specifiedIsCurrency0 == cfg.quoteIsCurrency0;
    }

    /// @dev Fixed pool tax, raised to the anti-snipe tax during the first seconds. Swaps made by
    ///      the launcher itself (the creator prebuy) are exempt from the anti-snipe component.
    function _taxBps(PoolConfig storage cfg, bytes32 id, bool isBuy, address sender)
        private
        view
        returns (uint256 bps)
    {
        bps = isBuy ? cfg.buyTaxBps : cfg.sellTaxBps;
        if (sender != factory) {
            uint256 snipe = currentSnipeTaxBps(id);
            if (snipe > bps) bps = snipe;
        }
    }

    /// @dev Books the tax as a PoolManager claim (settling the hook's credit from the swap): no
    ///      tokens leave the PoolManager mid-swap. `flushTaxes` pays it out later.
    function _collect(PoolConfig storage cfg, bytes32 id, bool isBuy, uint256 tax) private {
        poolManager.mint(address(this), uint256(uint160(cfg.quote)), tax);
        pendingTax[id] += tax;
        emit TaxCollected(id, isBuy, tax);
    }
}
