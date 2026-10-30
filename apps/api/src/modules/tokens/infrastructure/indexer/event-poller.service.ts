import { PublicClient, erc20Abi, parseAbiItem, type Address } from 'viem';
import {
  ROBINHOOD_CHAIN,
  bondingCurveAbi,
  type LaunchedTokenEntity,
  type NetworkConfig,
  type TradeEventEntity,
} from '@goton/shared-types';
import { TokenRepositoryPort } from '../../domain/ports/token.repository.port';
import { findAllTokens } from '../../application/all-tokens';
import { ViemChainIndexerAdapter } from '../adapters/viem-chain-indexer.adapter';
import { PriceFeedPort } from '../../domain/ports/price-feed.port';
import { CalculatePricingUseCase } from '../../application/use-cases/calculate-pricing.use-case';

// ---------------------------------------------------------------------------
// Event signatures
// ---------------------------------------------------------------------------

/** V1 — Uniswap V3 Swap event (graduated pools / v1 launches) */
const SWAP_EVENT = parseAbiItem(
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
);

/** V2 — BondingCurve Trade event */
const LIMIT_ORDER_EVENTS = [
  parseAbiItem(
    'event OrderCreated(uint256 indexed id, address indexed owner, address indexed token, (address owner, address token, bool isBuy, uint64 deadline, uint256 amount, uint256 minOut, uint256 slPriceX36, uint256 slMinOut) order)',
  ),
  parseAbiItem(
    'event OrderFilled(uint256 indexed id, address indexed executor, uint8 leg, uint256 amountIn, uint256 amountOut, uint256 fee)',
  ),
  parseAbiItem('event OrderCancelled(uint256 indexed id)'),
] as const;
const FILL_LEGS = ['takeProfit', 'stopLoss', 'buy'] as const;

const TRADE_EVENT = parseAbiItem(
  'event Trade(address indexed trader, bool indexed isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 feeEth)',
);

/** V4 — Uniswap V4 Swap event */
const V4_SWAP_EVENT = parseAbiItem(
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
const TOKEN_LAUNCHED_V1_EVENT = parseAbiItem(
  'event TokenLaunched(address indexed token, address indexed deployer, address indexed dexFactory, address pairedToken, address pool, uint256 dexId, uint256 launchConfigId, uint256 positionId, uint256 restrictionsEndBlock, uint256 initialBuyAmount)',
);

// Maximum block range per poll cycle (override with INDEXER_MAX_BLOCK_RANGE). Robinhood Chain makes
// ~10 blocks a second, so the range must be far above one interval's worth or the cursor falls
// behind for good; both RPCs answer 2,000-block getLogs well under a second.
const MAX_BLOCK_RANGE = BigInt(process.env.INDEXER_MAX_BLOCK_RANGE ?? '2000');
// Blocks to stay behind the chain head (override with INDEXER_CONFIRMATIONS)
const CONFIRMATIONS = BigInt(process.env.INDEXER_CONFIRMATIONS ?? '2');
// Maximum contract addresses per eth_getLogs request
const LOG_ADDRESS_BATCH = 50;
// Attempts at one block range before it is skipped (and logged as an error).
const MAX_RANGE_ATTEMPTS = 5;
// eth_getLogs block span per request when backfilling one curve's history.
const BACKFILL_CHUNK = BigInt(process.env.INDEXER_BACKFILL_CHUNK || '200000');

export class EventPollerService {
  private lastPolledBlock = 0n;
  /** True when the last cycle stopped short of the chain head; the caller polls again at once. */
  isBehind = false;
  private failedRangeStart: bigint | null = null;
  private rangeFailures = 0;
  private quoteDecimals: number | null = null;

  constructor(
    private readonly client: PublicClient,
    private readonly tokenRepository: TokenRepositoryPort,
    private readonly chainIndexer: ViemChainIndexerAdapter,
    private readonly calculatePricing: CalculatePricingUseCase,
    private readonly priceFeed: PriceFeedPort,
    private readonly network: NetworkConfig = ROBINHOOD_CHAIN,
  ) {}

  // -------------------------------------------------------------------------
  // Main polling loop
  // -------------------------------------------------------------------------

  async pollEvents(fromBlock?: bigint, toBlock?: bigint): Promise<number> {
    let currentBlock = 0n;
    try {
      // API-10: stay CONFIRMATIONS blocks behind the head so short reorgs never index dropped logs.
      currentBlock = toBlock ?? (await this.client.getBlockNumber()) - CONFIRMATIONS;

      if (this.lastPolledBlock === 0n && this.tokenRepository.getLastIndexedBlock) {
        try {
          const persisted = await this.tokenRepository.getLastIndexedBlock(this.network.name);
          if (persisted && persisted > 0n) {
            this.lastPolledBlock = persisted;
          }
        } catch {
          // fallback to live block
        }
      }

      const startBlock =
        fromBlock ??
        (this.lastPolledBlock > 0n ? this.lastPolledBlock + 1n : currentBlock - MAX_BLOCK_RANGE);

      if (startBlock > currentBlock) return 0;

      // Sequential batching: process at most MAX_BLOCK_RANGE blocks per cycle to respect RPC limits.
      // Never drop or skip blocks; subsequent cycles continue catch-up until currentBlock is reached.
      const batchEnd =
        currentBlock - startBlock > MAX_BLOCK_RANGE ? startBlock + MAX_BLOCK_RANGE : currentBlock;

      const count = await this.indexRange(startBlock, batchEnd);

      // Advance and persist lastPolledBlock only on success so a failed cycle retries the same range.
      this.lastPolledBlock = batchEnd;
      this.isBehind = batchEnd < currentBlock;
      if (this.tokenRepository.setLastIndexedBlock) {
        await this.tokenRepository.setLastIndexedBlock(this.network.name, batchEnd);
      }
      return count;
    } catch (error) {
      // A range that keeps failing (e.g. one malformed log) must not stall indexing forever:
      // after MAX_RANGE_ATTEMPTS the range is skipped, loudly.
      const failedStart = fromBlock ?? (this.lastPolledBlock > 0n ? this.lastPolledBlock + 1n : 0n);
      this.rangeFailures = this.failedRangeStart === failedStart ? this.rangeFailures + 1 : 1;
      this.failedRangeStart = failedStart;
      if (
        this.rangeFailures >= MAX_RANGE_ATTEMPTS &&
        fromBlock === undefined &&
        currentBlock > 0n
      ) {
        const skipTo =
          currentBlock - failedStart > MAX_BLOCK_RANGE
            ? failedStart + MAX_BLOCK_RANGE
            : currentBlock;
        console.error(
          `[EventPoller:${this.network.name}] skipping blocks ${failedStart}-${skipTo} after ${this.rangeFailures} failed attempts`,
        );
        this.lastPolledBlock = skipTo;
        this.rangeFailures = 0;
        void this.tokenRepository.setLastIndexedBlock?.(this.network.name, skipTo);
      }
      const e = error as { code?: number; message?: string };
      if (e?.code === 429 || e?.message?.includes('Too Many Requests')) {
        console.warn(`[EventPoller:${this.network.name}] RPC 429 — backing off`);
      } else {
        console.error(`[EventPoller:${this.network.name}] pollEvents error:`, error);
      }
      // Do NOT advance lastPolledBlock on error; next cycle will retry from the same position.
      // Advancing on failure would permanently skip the failed block range.
      return 0;
    }
  }

  /**
   * Indexes launches, graduations and trades in [from, to] without moving the live cursor.
   * Used by the poller and by scripts/backfill-tokens.ts (DR-06); throws on RPC errors so the
   * caller can retry the same range.
   */
  async indexRange(from: bigint, to: bigint): Promise<number> {
    let count = 0;
    count += await this.pollV1Launches(from, to);
    count += await this.pollV2Launches(from, to);
    count += await this.pollV4Launches(from, to);
    count += await this.pollGraduations(from, to);
    count += await this.pollV2Trades(from, to);
    count += await this.pollV1Swaps(from, to);
    count += await this.pollV4Swaps(from, to);
    count += await this.pollLimitOrders(from, to);
    return count;
  }

  // -------------------------------------------------------------------------
  // V1 token launches
  // -------------------------------------------------------------------------

  private async pollV1Launches(from: bigint, to: bigint): Promise<number> {
    const factory = this.network.contracts.factory;
    const factoryV2 = this.network.contracts.factoryV2;

    // Skip V1 poll if factory === factoryV2 (Arc uses V2-only)
    if (!factory || factory === '0x0000000000000000000000000000000000000000') return 0;
    if (factory === factoryV2) return 0;

    try {
      const logs = await this.client.getLogs({
        address: factory as Address,
        event: TOKEN_LAUNCHED_V1_EVENT,
        fromBlock: from,
        toBlock: to,
      });

      for (const log of logs) {
        const tokenAddress = log.args.token as Address;
        if (!tokenAddress) continue;
        const entity = await this.chainIndexer.fetchLaunchedTokenFromChain(
          tokenAddress,
          this.network,
        );
        if (entity) await this.tokenRepository.save(entity);
      }
      return logs.length;
    } catch (e) {
      console.warn(
        `[EventPoller:${this.network.name}] V1 launch poll error:`,
        (e as Error).message,
      );
      // Rethrow so pollEvents keeps the cursor and retries this range.
      throw e;
    }
  }

  // -------------------------------------------------------------------------
  // V2 token launches (BondingCurve factory)
  // -------------------------------------------------------------------------

  private async pollV2Launches(from: bigint, to: bigint): Promise<number> {
    const factoryV2 = this.network.contracts.factoryV2 ?? this.network.contracts.factory;
    if (!factoryV2 || factoryV2 === '0x0000000000000000000000000000000000000000') return 0;

    try {
      const [logs1, logs2] = await Promise.all([
        this.client
          .getLogs({
            address: factoryV2 as Address,
            event: TOKEN_LAUNCHED_V2_EVENT,
            fromBlock: from,
            toBlock: to,
          })
          .catch(() => []),
        this.client
          .getLogs({
            address: factoryV2 as Address,
            event: TOKEN_LAUNCHED_V2_STANDARD_EVENT,
            fromBlock: from,
            toBlock: to,
          })
          .catch(() => []),
      ]);
      const logs = [...logs1, ...logs2];
      for (const log of logs) {
        const tokenAddress = log.args.token as Address;
        const curveAddress = log.args.curve as Address;
        if (!tokenAddress || !curveAddress) continue;

        // Skip RPC fetch if this token is already indexed
        const existing = await this.tokenRepository.findByAddress(tokenAddress);
        if (existing) continue;

        const entity = await this.chainIndexer.fetchV2LaunchedToken(
          tokenAddress,
          curveAddress,
          this.network,
        );
        if (entity) {
          await this.tokenRepository.save({
            ...entity,
            version: 'v2',
            curveAddress,
          });
        }
      }
      return logs.length;
    } catch (e) {
      console.warn(
        `[EventPoller:${this.network.name}] V2 launch poll error:`,
        (e as Error).message,
      );
      // Rethrow so pollEvents keeps the cursor and retries this range.
      throw e;
    }
  }

  // -------------------------------------------------------------------------
  // In-pool v4 launches and curve graduations
  // -------------------------------------------------------------------------

  private async pollV4Launches(from: bigint, to: bigint): Promise<number> {
    const factory = this.network.contracts.factoryV2 ?? this.network.contracts.factory;
    if (!factory || factory === '0x0000000000000000000000000000000000000000') return 0;
    try {
      const logs = await this.client.getLogs({
        address: factory as Address,
        event: TOKEN_LAUNCHED_V4_EVENT,
        fromBlock: from,
        toBlock: to,
      });
      for (const log of logs) {
        const { token, poolId, creator, prebuyUsdc6 } = log.args;
        if (!token || !poolId || !creator) continue;
        if (await this.tokenRepository.findByAddress(token)) continue;
        const entity = await this.chainIndexer.fetchV4LaunchedToken(
          token,
          poolId,
          creator,
          prebuyUsdc6 ?? 0n,
          this.network,
        );
        if (entity) await this.tokenRepository.save(entity);
      }
      return logs.length;
    } catch (e) {
      console.warn(
        `[EventPoller:${this.network.name}] V4 launch poll error:`,
        (e as Error).message,
      );
      // Rethrow so pollEvents keeps the cursor and retries this range.
      throw e;
    }
  }

  /** Points graduated tokens at their v4 pool id so pollV4Swaps picks up their trades. */
  private async pollGraduations(from: bigint, to: bigint): Promise<number> {
    const factory = this.network.contracts.factoryV2 ?? this.network.contracts.factory;
    if (!factory || factory === '0x0000000000000000000000000000000000000000') return 0;
    try {
      const logs = await this.client.getLogs({
        address: factory as Address,
        event: TOKEN_GRADUATED_EVENT,
        fromBlock: from,
        toBlock: to,
      });
      for (const log of logs) {
        const { token, poolId } = log.args;
        if (!token || !poolId) continue;
        const existing = await this.tokenRepository.findByAddress(token);
        if (!existing) continue;
        await this.tokenRepository.save({
          ...existing,
          poolAddress: poolId,
          // Native ETH is always currency0 in graduated pools.
          isToken0: false,
          isGraduated: true,
        });
      }
      return logs.length;
    } catch (e) {
      console.warn(
        `[EventPoller:${this.network.name}] Graduation poll error:`,
        (e as Error).message,
      );
      // Rethrow so pollEvents keeps the cursor and retries this range.
      throw e;
    }
  }

  // -------------------------------------------------------------------------
  // V2 Trade events from BondingCurve contracts
  // This is the correct event for bonding curve tokens — NOT Uniswap Swap
  // -------------------------------------------------------------------------

  private async pollV2Trades(from: bigint, to: bigint): Promise<number> {
    // Fetch all V2 tokens from repository
    const allTokens = await findAllTokens(this.tokenRepository);
    const v2Tokens = allTokens.filter(
      (t) =>
        t.version === 'v2' &&
        typeof t.poolAddress === 'string' &&
        t.poolAddress.length === 42 &&
        t.poolAddress.startsWith('0x'),
    );

    if (v2Tokens.length === 0) return 0;

    const curveAddresses = v2Tokens.map((t) => t.poolAddress as Address);
    const quotePriceUsd = await this.priceFeed.getQuoteAssetPriceUsd(this.network.chainId);

    try {
      // API-08: query in address batches so a growing token list never exceeds RPC limits.
      const logs = [];
      for (let i = 0; i < curveAddresses.length; i += LOG_ADDRESS_BATCH) {
        const batch = curveAddresses.slice(i, i + LOG_ADDRESS_BATCH);
        logs.push(
          ...(await this.client.getLogs({
            address: batch.length === 1 ? batch[0] : batch,
            event: TRADE_EVENT,
            fromBlock: from,
            toBlock: to,
          })),
        );
      }

      if (logs.length === 0) return 0;

      const tokenByCurve = new Map(v2Tokens.map((t) => [t.poolAddress.toLowerCase(), t]));
      return await this.saveTradeLogs(logs, tokenByCurve, quotePriceUsd);
    } catch (e) {
      console.warn(`[EventPoller:${this.network.name}] V2 trade poll error:`, (e as Error).message);
      // Rethrow so pollEvents keeps the cursor and retries this range.
      throw e;
    }
  }

  // -------------------------------------------------------------------------
  // V1 Swap events from Uniswap V3 pools (graduated / v1 tokens only)
  // -------------------------------------------------------------------------

  private async pollV1Swaps(from: bigint, to: bigint): Promise<number> {
    const allTokens = await findAllTokens(this.tokenRepository);
    // Only poll V1 tokens (or graduated V2 which now have a Uniswap V3 pool)
    const v1Tokens = allTokens.filter(
      (t) =>
        (t.version === 'v1' || t.isGraduated) &&
        typeof t.poolAddress === 'string' &&
        t.poolAddress.length === 42 &&
        t.poolAddress.startsWith('0x'),
    );

    if (v1Tokens.length === 0) return 0;

    const quotePriceUsd = await this.priceFeed.getQuoteAssetPriceUsd(this.network.chainId);

    try {
      const poolAddresses = v1Tokens.map((t) => t.poolAddress as Address);
      // API-08: same address batching as the V2 trade poll.
      const logs = [];
      for (let i = 0; i < poolAddresses.length; i += LOG_ADDRESS_BATCH) {
        const batch = poolAddresses.slice(i, i + LOG_ADDRESS_BATCH);
        logs.push(
          ...(await this.client.getLogs({
            address: batch.length === 1 ? batch[0] : batch,
            event: SWAP_EVENT,
            fromBlock: from,
            toBlock: to,
          })),
        );
      }

      if (logs.length === 0) return 0;

      const tokenByPool = new Map(v1Tokens.map((t) => [t.poolAddress.toLowerCase(), t]));
      const blockTimestamps = new Map<bigint, number>();

      let count = 0;
      for (const swap of logs) {
        const token = tokenByPool.get(swap.address.toLowerCase());
        if (!token) continue;

        const { sender, recipient, amount0, amount1, sqrtPriceX96 } = swap.args as {
          sender: Address;
          recipient: Address;
          amount0: bigint;
          amount1: bigint;
          sqrtPriceX96: bigint;
          liquidity: bigint;
          tick: number;
        };

        if (amount0 === undefined || amount1 === undefined) continue;

        const isToken0 = token.isToken0;
        // Uniswap V3 sign convention: negative amount = asset flows OUT of the pool (to user).
        // Buy token = token flows out of pool → tokenAmount < 0.
        // token is amount0 when isToken0, amount1 otherwise.
        const tokenAmountSigned = isToken0 ? amount0 : amount1;
        const isBuy = tokenAmountSigned < 0n;

        const tokenAmountRaw = Math.abs(Number(tokenAmountSigned)) / 1e18;
        const wethAmountSigned = isToken0 ? amount1 : amount0;
        const wethAmountRaw = Math.abs(Number(wethAmountSigned)) / 1e18;

        const marketData = this.calculatePricing.execute({
          address: token.address,
          sqrtPriceX96: sqrtPriceX96 ?? 2505414483750479299401734n,
          isToken0: token.isToken0,
          pairedPrincipalWei: 0n,
          ethPriceUsd: quotePriceUsd,
          totalSupply: BigInt(token.totalSupply || '1000000000000000000000000000'),
        });

        const blockNumber = swap.blockNumber ?? 0n;
        let timestamp = blockTimestamps.get(blockNumber);
        if (timestamp === undefined) {
          try {
            const block = await this.client.getBlock({ blockNumber });
            timestamp = Number(block.timestamp) * 1000;
          } catch {
            timestamp = Date.now();
          }
          blockTimestamps.set(blockNumber, timestamp);
        }

        const trade: TradeEventEntity = {
          id: `${swap.transactionHash}-${swap.logIndex}`,
          tokenAddress: token.address,
          poolAddress: token.poolAddress,
          trader: (recipient ?? sender ?? '0x0000000000000000000000000000000000000000') as Address,
          isBuy,
          tokenAmount: tokenAmountRaw.toFixed(4),
          wethAmount: wethAmountRaw.toFixed(6),
          priceUsd: marketData.priceUsd,
          blockNumber,
          transactionHash: swap.transactionHash ?? '0x0',
          timestamp,
        };

        await this.tokenRepository.saveTrade(trade);
        count++;
      }
      return count;
    } catch (e) {
      console.warn(`[EventPoller:${this.network.name}] V1 swap poll error:`, (e as Error).message);
      // Rethrow so pollEvents keeps the cursor and retries this range.
      throw e;
    }
  }

  /** Decimals of the pool quote currency (18 for ETH / WETH, 6 for Arc USDC), read once. */
  private async getQuoteDecimals(): Promise<number> {
    if (this.quoteDecimals === null) {
      this.quoteDecimals = await this.client
        .readContract({
          address: this.network.contracts.weth,
          abi: erc20Abi,
          functionName: 'decimals',
        })
        .catch(() => this.network.nativeCurrency.decimals);
    }
    return this.quoteDecimals;
  }

  private async pollV4Swaps(from: bigint, to: bigint): Promise<number> {
    const poolManager = this.network.contracts.poolManagerV4;
    if (!poolManager || poolManager === '0x0000000000000000000000000000000000000000') return 0;

    try {
      const logs = await this.client.getLogs({
        address: poolManager as Address,
        event: V4_SWAP_EVENT,
        fromBlock: from,
        toBlock: to,
      });

      if (logs.length === 0) return 0;

      const allTokens = await findAllTokens(this.tokenRepository);
      const tokenByPoolId = new Map(allTokens.map((t) => [t.poolAddress.toLowerCase(), t]));
      const quotePriceUsd = await this.priceFeed.getQuoteAssetPriceUsd(this.network.chainId);
      const blockTimestamps = new Map<bigint, number>();
      // A v4 Swap's `sender` is the contract that called the PoolManager (GotonV4Router), not the
      // wallet; the trader is whoever sent the transaction.
      const traders = new Map<string, Address>();

      let count = 0;
      for (const log of logs) {
        const poolId = (log.args as { id?: string })?.id?.toLowerCase();
        if (!poolId) continue;
        const token = tokenByPoolId.get(poolId);
        if (!token) continue;

        const { sender, amount0, amount1 } = log.args as {
          sender?: Address;
          amount0?: bigint;
          amount1?: bigint;
        };
        if (amount0 === undefined || amount1 === undefined) continue;

        // v4 Swap amounts are the swapper's deltas: negative = paid into the pool. The quote
        // side is whichever currency is not the token (token.isToken0 tells the order).
        const quoteDecimals = await this.getQuoteDecimals();
        const quoteDelta = token.isToken0 ? amount1 : amount0;
        const tokenDelta = token.isToken0 ? amount0 : amount1;
        const usdcAmountNum = Math.abs(Number(quoteDelta)) / 10 ** quoteDecimals;
        const tokenAmountNum = Math.abs(Number(tokenDelta)) / 1e18;
        const isBuy = quoteDelta < 0n;

        let priceUsd = 0;
        if (tokenAmountNum > 0) {
          priceUsd = (usdcAmountNum / tokenAmountNum) * quotePriceUsd;
        }

        const blockNumber = log.blockNumber ?? 0n;
        let timestamp = blockTimestamps.get(blockNumber);
        if (timestamp === undefined) {
          try {
            const block = await this.client.getBlock({ blockNumber });
            timestamp = Number(block.timestamp) * 1000;
          } catch {
            timestamp = Date.now();
          }
          blockTimestamps.set(blockNumber, timestamp);
        }

        let trader = log.transactionHash ? traders.get(log.transactionHash) : undefined;
        if (!trader && log.transactionHash) {
          try {
            trader = (await this.client.getTransaction({ hash: log.transactionHash })).from;
          } catch {
            trader = sender;
          }
          if (trader) traders.set(log.transactionHash, trader);
        }

        const trade: TradeEventEntity = {
          id: `${log.transactionHash}-${log.logIndex}`,
          tokenAddress: token.address,
          poolAddress: token.poolAddress,
          trader: (trader ?? sender ?? '0x0000000000000000000000000000000000000000') as Address,
          isBuy,
          tokenAmount: tokenAmountNum.toFixed(4),
          wethAmount: usdcAmountNum.toFixed(6),
          priceUsd,
          blockNumber,
          transactionHash: log.transactionHash ?? '0x0',
          timestamp,
        };

        await this.tokenRepository.saveTrade(trade);
        count++;
      }
      return count;
    } catch (e) {
      console.warn(`[EventPoller:${this.network.name}] V4 swap poll error:`, (e as Error).message);
      throw e;
    }
  }

  // -------------------------------------------------------------------------
  // Limit orders (GotonLimitOrders)
  // -------------------------------------------------------------------------

  private async pollLimitOrders(from: bigint, to: bigint): Promise<number> {
    const address = this.network.contracts.limitOrders;
    if (!address || address === '0x0000000000000000000000000000000000000000') return 0;
    if (!this.tokenRepository.saveLimitOrder || !this.tokenRepository.updateLimitOrder) return 0;
    try {
      const logs = await this.client.getLogs({
        address,
        events: LIMIT_ORDER_EVENTS,
        fromBlock: from,
        toBlock: to,
      });
      const chainId = this.network.chainId;
      for (const log of logs) {
        const key = `${chainId}-${log.args.id}`;
        if (log.eventName === 'OrderCreated') {
          const o = log.args.order!;
          const block = await this.client.getBlock({ blockNumber: log.blockNumber! });
          const at = Number(block.timestamp) * 1000;
          await this.tokenRepository.saveLimitOrder({
            key,
            chainId,
            orderId: String(log.args.id),
            owner: o.owner,
            token: o.token,
            isBuy: o.isBuy,
            amount: o.amount.toString(),
            minOut: o.minOut.toString(),
            slPriceX36: o.slPriceX36.toString(),
            slMinOut: o.slMinOut.toString(),
            deadline: Number(o.deadline),
            status: 'open',
            createdTx: log.transactionHash!,
            createdAt: at,
            updatedAt: at,
          });
        } else if (log.eventName === 'OrderFilled') {
          await this.tokenRepository.updateLimitOrder(key, {
            status: 'filled',
            filledLeg: FILL_LEGS[Number(log.args.leg)] ?? 'buy',
            amountOut: String(log.args.amountOut),
            closedTx: log.transactionHash!,
          });
        } else {
          await this.tokenRepository.updateLimitOrder(key, {
            status: 'cancelled',
            closedTx: log.transactionHash!,
          });
        }
      }
      return logs.length;
    } catch (e) {
      console.warn(
        `[EventPoller:${this.network.name}] limit order poll error:`,
        (e as Error).message,
      );
      throw e;
    }
  }

  /** Saves decoded curve Trade logs (idempotent: trade ids are txHash-logIndex). */
  private async saveTradeLogs(
    logs: Awaited<ReturnType<EventPollerService['fetchTradeLogs']>>,
    tokenByCurve: Map<string, LaunchedTokenEntity>,
    quotePriceUsd: number,
  ): Promise<number> {
    const blockTimestamps = new Map<bigint, number>();

    let count = 0;
    for (const log of logs) {
      const token = tokenByCurve.get(log.address.toLowerCase());
      if (!token) continue;

      const { trader, isBuy, ethAmount, tokenAmount } = log.args as {
        trader: Address;
        isBuy: boolean;
        ethAmount: bigint;
        tokenAmount: bigint;
        feeEth: bigint;
      };

      if (ethAmount === undefined || tokenAmount === undefined) continue;

      const ethAmountNum = Number(ethAmount) / 1e18;
      const tokenAmountNum = Number(tokenAmount) / 1e18;

      let priceUsd = 0;
      if (tokenAmountNum > 0) {
        const priceNative = ethAmountNum / tokenAmountNum;
        priceUsd = priceNative * quotePriceUsd;
      }

      if (priceUsd <= 0) {
        try {
          const [vEth, vToken] = await Promise.all([
            this.client.readContract({
              address: log.address,
              abi: bondingCurveAbi,
              functionName: 'virtualEthReserve',
            }) as Promise<bigint>,
            this.client.readContract({
              address: log.address,
              abi: bondingCurveAbi,
              functionName: 'virtualTokenReserve',
            }) as Promise<bigint>,
          ]);
          if (vToken > 0n) {
            priceUsd = (Number(vEth) / Number(vToken)) * quotePriceUsd;
          }
        } catch {
          // fallback
        }
      }

      const blockNumber = log.blockNumber ?? 0n;
      let timestamp = blockTimestamps.get(blockNumber);
      if (timestamp === undefined) {
        try {
          const block = await this.client.getBlock({ blockNumber });
          // Arc Network block.timestamp is in seconds (Unix standard)
          timestamp = Number(block.timestamp) * 1000;
        } catch {
          timestamp = Date.now();
        }
        blockTimestamps.set(blockNumber, timestamp);
      }

      const trade: TradeEventEntity = {
        id: `${log.transactionHash}-${log.logIndex}`,
        tokenAddress: token.address,
        poolAddress: token.poolAddress,
        trader,
        isBuy,
        tokenAmount: tokenAmountNum.toFixed(4),
        wethAmount: ethAmountNum.toFixed(6),
        priceUsd,
        blockNumber,
        transactionHash: log.transactionHash ?? '0x0',
        timestamp,
      };

      await this.tokenRepository.saveTrade(trade);
      if (priceUsd > 0) {
        const mkt = await this.tokenRepository.getMarketData(token.address);
        if (mkt) {
          const supplyTokens = token.totalSupply
            ? Number(BigInt(token.totalSupply)) / 1e18
            : 1_000_000_000;
          // Recompute 24h volume from stored trades so the value is always accurate
          // and never lost when saveMarketData overwrites the DB row.
          const cutoff24h = Date.now() - 86_400_000;
          const recentTrades = await this.tokenRepository.getTrades(token.address, 500, 0);
          const volume24hUsd = recentTrades
            .filter((t) => (t.timestamp ?? 0) >= cutoff24h)
            .reduce((sum, t) => sum + parseFloat(t.wethAmount || '0') * quotePriceUsd, 0);
          await this.tokenRepository.saveMarketData({
            ...mkt,
            priceUsd,
            priceInWeth: priceUsd / quotePriceUsd,
            marketCapUsd: priceUsd * supplyTokens,
            fdvUsd: priceUsd * supplyTokens,
            volume24hUsd,
          });
        }
      }
      count++;
    }
    return count;
  }

  private fetchTradeLogs(address: Address | Address[], fromBlock: bigint, toBlock: bigint) {
    return this.client.getLogs({ address, event: TRADE_EVENT, fromBlock, toBlock });
  }

  /**
   * Indexes a v2 curve's trades in [from, to] in large chunks. For tokens that entered the database
   * after the live cursor passed their first trades (discovered on a page visit or a late sync),
   * whose earlier trades the poller would otherwise never see. Idempotent.
   */
  async backfillCurveTrades(
    token: LaunchedTokenEntity,
    from: bigint,
    to?: bigint,
  ): Promise<number> {
    const curve = (token.curveAddress || token.poolAddress) as Address;
    if (token.version !== 'v2' || !curve || curve.length !== 42) return 0;
    const end =
      to ??
      (this.lastPolledBlock > 0n
        ? this.lastPolledBlock
        : (await this.client.getBlockNumber()) - CONFIRMATIONS);
    const quotePriceUsd = await this.priceFeed.getQuoteAssetPriceUsd(this.network.chainId);
    const tokenByCurve = new Map([[curve.toLowerCase(), token]]);
    let count = 0;
    for (let start = from < 0n ? 0n : from; start <= end; start += BACKFILL_CHUNK) {
      const chunkEnd = start + BACKFILL_CHUNK - 1n > end ? end : start + BACKFILL_CHUNK - 1n;
      const logs = await this.fetchTradeLogs(curve, start, chunkEnd);
      if (logs.length) count += await this.saveTradeLogs(logs, tokenByCurve, quotePriceUsd);
    }
    return count;
  }
}
