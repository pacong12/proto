import { PublicClient, erc20Abi, parseAbiItem, type Address } from 'viem';
import {
  ROBINHOOD_CHAIN,
  bondingCurveAbi,
  type NetworkConfig,
  type TradeEventEntity,
} from '@goton/shared-types';
import { TokenRepositoryPort } from '../../domain/ports/token.repository.port';
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
const TRADE_EVENT = parseAbiItem(
  'event Trade(address indexed trader, bool indexed isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 feeEth)',
);

/** V4 — Uniswap V4 Swap event */
const V4_SWAP_EVENT = parseAbiItem(
  'event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)',
);

/** V2 BondingCurve - TokenLaunched from factory (same event name as V1 but different signature).
 * topic0: 0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607
 * Canonical Goton V2 Factory: 0xbA42499Cfe59abc05120A100EEc4f859F476034F
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

// Maximum block range per poll — keeps RPC requests under 2s
const MAX_BLOCK_RANGE = 50n;
// Blocks to stay behind the chain head (override with INDEXER_CONFIRMATIONS)
const CONFIRMATIONS = BigInt(process.env.INDEXER_CONFIRMATIONS ?? '2');
// Maximum contract addresses per eth_getLogs request
const LOG_ADDRESS_BATCH = 50;

export class EventPollerService {
  private lastPolledBlock = 0n;
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
      if (this.tokenRepository.setLastIndexedBlock) {
        await this.tokenRepository.setLastIndexedBlock(this.network.name, batchEnd);
      }
      return count;
    } catch (error) {
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
      return 0;
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
      return 0;
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
      return 0;
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
      return 0;
    }
  }

  // -------------------------------------------------------------------------
  // V2 Trade events from BondingCurve contracts
  // This is the correct event for bonding curve tokens — NOT Uniswap Swap
  // -------------------------------------------------------------------------

  private async pollV2Trades(from: bigint, to: bigint): Promise<number> {
    // Fetch all V2 tokens from repository
    const allTokens = await this.tokenRepository.findAll(200, 0);
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

      // Map curveAddress -> token for O(1) lookup
      const tokenByCurve = new Map(v2Tokens.map((t) => [t.poolAddress.toLowerCase(), t]));
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
    } catch (e) {
      console.warn(`[EventPoller:${this.network.name}] V2 trade poll error:`, (e as Error).message);
      return 0;
    }
  }

  // -------------------------------------------------------------------------
  // V1 Swap events from Uniswap V3 pools (graduated / v1 tokens only)
  // -------------------------------------------------------------------------

  private async pollV1Swaps(from: bigint, to: bigint): Promise<number> {
    const allTokens = await this.tokenRepository.findAll(200, 0);
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
      const logs = await this.client.getLogs({
        address: poolAddresses.length === 1 ? poolAddresses[0] : poolAddresses,
        event: SWAP_EVENT,
        fromBlock: from,
        toBlock: to,
      });

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
      return 0;
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

      const allTokens = await this.tokenRepository.findAll(500, 0);
      const tokenByPoolId = new Map(allTokens.map((t) => [t.poolAddress.toLowerCase(), t]));
      const quotePriceUsd = await this.priceFeed.getQuoteAssetPriceUsd(this.network.chainId);
      const blockTimestamps = new Map<bigint, number>();

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

        const trade: TradeEventEntity = {
          id: `${log.transactionHash}-${log.logIndex}`,
          tokenAddress: token.address,
          poolAddress: token.poolAddress,
          trader: (sender ?? '0x0000000000000000000000000000000000000000') as Address,
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
    } catch {
      return 0;
    }
  }
}
