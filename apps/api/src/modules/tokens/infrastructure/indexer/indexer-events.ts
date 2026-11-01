import { parseAbiItem } from 'viem';

// ---------------------------------------------------------------------------
// Event signatures
// ---------------------------------------------------------------------------

/** V1 — Uniswap V3 Swap event (graduated pools / v1 launches) */
export const SWAP_EVENT = parseAbiItem(
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
);

/** V2 — BondingCurve Trade event */
export const LIMIT_ORDER_EVENTS = [
  parseAbiItem(
    'event OrderCreated(uint256 indexed id, address indexed owner, address indexed token, (address owner, address token, bool isBuy, uint64 deadline, uint256 amount, uint256 minOut, uint256 slPriceX36, uint256 slMinOut) order)',
  ),
  parseAbiItem(
    'event OrderFilled(uint256 indexed id, address indexed executor, uint8 leg, uint256 amountIn, uint256 amountOut, uint256 fee)',
  ),
  parseAbiItem('event OrderCancelled(uint256 indexed id)'),
] as const;
export const FILL_LEGS = ['takeProfit', 'stopLoss', 'buy'] as const;
export const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
);
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const LAUNCH_BLOCK_ABI = [
  parseAbiItem('function launchBlock() view returns (uint256)'),
] as const;
/** Wait before retrying a token whose holder backfill failed. */
export const HOLDER_RETRY_MS = 10 * 60_000;

export const TRADE_EVENT = parseAbiItem(
  'event Trade(address indexed trader, bool indexed isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 feeEth)',
);

/** V4 — Uniswap V4 Swap event */
export const V4_SWAP_EVENT = parseAbiItem(
  'event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)',
);

/** V2 BondingCurve - TokenLaunched from factory (same event name as V1 but different signature).
 * topic0: 0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607
 * Polled on the configured factoryV2 (network.contracts.factoryV2).
 */
export const TOKEN_LAUNCHED_V2_EVENT = parseAbiItem(
  'event TokenLaunched(address indexed token, address indexed curve, address indexed creator, address pairedToken, uint256 positionId, uint256 initialBuyAmount)',
);
export const TOKEN_LAUNCHED_V2_STANDARD_EVENT = parseAbiItem(
  'event TokenLaunchedV2(address indexed token, address indexed curve, address indexed creator, string name, string symbol, uint256 initialBuy)',
);

/** In-pool v4 launch (LaunchpadV2FactoryArc): the token trades in its v4 pool from block one. */
export const TOKEN_LAUNCHED_V4_EVENT = parseAbiItem(
  'event TokenLaunchedV4(address indexed token, bytes32 indexed poolId, address indexed creator, address splitter, string name, string symbol, uint256 prebuyUsdc6, uint256 creatorTokens)',
);

/** Bonding-curve factory: a curve's liquidity moved into its locked v4 pool. */
export const TOKEN_GRADUATED_EVENT = parseAbiItem(
  'event TokenGraduated(address indexed token, bytes32 indexed poolId, address splitter)',
);

/** V1 — TokenLaunched from factory */
export const TOKEN_LAUNCHED_V1_EVENT = parseAbiItem(
  'event TokenLaunched(address indexed token, address indexed deployer, address indexed dexFactory, address pairedToken, address pool, uint256 dexId, uint256 launchConfigId, uint256 positionId, uint256 restrictionsEndBlock, uint256 initialBuyAmount)',
);

// Maximum block range per poll cycle (override with INDEXER_MAX_BLOCK_RANGE). Robinhood Chain makes
// ~10 blocks a second, so the range must be far above one interval's worth or the cursor falls
// behind for good; both RPCs answer 2,000-block getLogs well under a second.
export const MAX_BLOCK_RANGE = BigInt(process.env.INDEXER_MAX_BLOCK_RANGE ?? '2000');
// Blocks to stay behind the chain head (override with INDEXER_CONFIRMATIONS)
export const CONFIRMATIONS = BigInt(process.env.INDEXER_CONFIRMATIONS ?? '2');
// Maximum contract addresses per eth_getLogs request
export const LOG_ADDRESS_BATCH = 50;
// Attempts at one block range before it is skipped (and logged as an error).
export const MAX_RANGE_ATTEMPTS = 5;
// eth_getLogs block span per request when backfilling one curve's history, capped per chain by
// NetworkConfig.maxLogBlockRange.
export const BACKFILL_CHUNK = BigInt(process.env.INDEXER_BACKFILL_CHUNK || '200000');
// A backfill is hundreds of requests in a row, paced by NetworkConfig.backfillRequestIntervalMs; a
// rate-limited one is retried after these pauses rather than failing the whole history. The
// fallback RPCs cannot take over: they keep no old history or only accept a few blocks per request.
export const BACKFILL_RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000];
