// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey, PoolIdLibrary} from "../interfaces/IUniswapV4.sol";
import {IPoolManagerV4, SwapParams} from "../interfaces/external/IUniswapV4Core.sol";
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
 *           tax) in the quote currency — native ETH or an ERC-20 such as Arc USDC — and forwards
 *           it to the token's GotonFeeSplitter.
 *         - Tracks in-pool graduation: `bonded` flips to false once price crosses `bondTick`.
 *         - Keeps a tick accumulator per pool (Uniswap V3 oracle semantics) so `consultTick` returns
 *           a TWAP over at least ORACLE_PERIOD, used to price-guard protocol buybacks.
 *
 *         The hook address's low 14 bits must equal PROTO_V4_HOOK_FLAGS (mined via CREATE2).
 */
contract GotonV4Hook {
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

    /// @dev Tick accumulator plus two checkpoints at least ORACLE_PERIOD apart.
    struct Oracle {
        int56 tickCumulative;
        uint32 lastTimestamp;
        int56 olderCumulative;
        uint32 olderTimestamp;
        int56 newerCumulative;
        uint32 newerTimestamp;
    }

    uint32 public constant ORACLE_PERIOD = 30 minutes;

    mapping(bytes32 => PoolConfig) public pools;
    mapping(bytes32 => Oracle) public oracles;

    event FactorySet(address indexed factory);
    event PoolRegistered(bytes32 indexed poolId, address indexed token, address splitter, uint16 buyTaxBps, uint16 sellTaxBps);
    event TaxCollected(bytes32 indexed poolId, bool isBuy, uint256 amount);
    event BondGraduated(bytes32 indexed poolId, int24 tick);

    error Unauthorized();
    error ZeroAddress();
    error InvalidHookAddress();
    error PoolNotRegistered();
    error PoolAlreadyRegistered();
    error FactoryAlreadySet();
    error OracleNotReady();

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

    function beforeInitialize(address sender, PoolKey calldata key, uint160) external view onlyPoolManager returns (bytes4) {
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
    // TWAP oracle
    // ---------------------------------------------------------------------------

    /**
     * @notice Time-weighted average tick of the pool over the window ending now and starting at the
     *         older checkpoint (between ORACLE_PERIOD and 2 × ORACLE_PERIOD ago while trading is active).
     * @dev Reverts until the pool has traded across at least one full ORACLE_PERIOD.
     */
    function consultTick(bytes32 poolId) external view returns (int24 twapTick, uint32 window) {
        Oracle memory o = oracles[poolId];
        if (o.olderTimestamp == 0) revert OracleNotReady();
        (, int24 tick) = V4Lib.getSlot0(poolManager, poolId);
        int56 cumulativeNow = o.tickCumulative + int56(tick) * int56(uint56(uint32(block.timestamp) - o.lastTimestamp));
        window = uint32(block.timestamp) - o.olderTimestamp;
        if (window == 0) revert OracleNotReady();
        int56 delta = cumulativeNow - o.olderCumulative;
        twapTick = int24(delta / int56(uint56(window)));
        // slither-disable-next-line weak-prng (modulo rounds the TWAP toward -inf; no randomness involved)
        if (delta < 0 && delta % int56(uint56(window)) != 0) twapTick--; // round towards -infinity
    }

    /// @dev Accumulates the tick that prevailed since the last swap (read before this swap moves it).
    function _writeOracle(bytes32 id) private {
        Oracle storage o = oracles[id];
        uint32 nowTs = uint32(block.timestamp);
        if (o.lastTimestamp == 0) {
            o.lastTimestamp = nowTs;
            o.newerTimestamp = nowTs;
            return;
        }
        if (nowTs == o.lastTimestamp) return;
        (, int24 tick) = V4Lib.getSlot0(poolManager, id);
        o.tickCumulative += int56(tick) * int56(uint56(nowTs - o.lastTimestamp));
        o.lastTimestamp = nowTs;
        if (nowTs - o.newerTimestamp >= ORACLE_PERIOD) {
            o.olderCumulative = o.newerCumulative;
            o.olderTimestamp = o.newerTimestamp;
            o.newerCumulative = o.tickCumulative;
            o.newerTimestamp = nowTs;
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
    function _taxBps(PoolConfig storage cfg, bytes32 id, bool isBuy, address sender) private view returns (uint256 bps) {
        bps = isBuy ? cfg.buyTaxBps : cfg.sellTaxBps;
        if (sender != factory) {
            uint256 snipe = currentSnipeTaxBps(id);
            if (snipe > bps) bps = snipe;
        }
    }

    function _collect(PoolConfig storage cfg, bytes32 id, bool isBuy, uint256 tax) private {
        poolManager.take(cfg.quote, cfg.splitter, tax);
        IFeeSplitter(cfg.splitter).distributeFees(tax);
        emit TaxCollected(id, isBuy, tax);
    }
}
