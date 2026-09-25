import { PublicClient, parseAbiItem, type Address } from 'viem';
import { ROBINHOOD_CHAIN, type NetworkConfig, type TradeEventEntity } from '@proto/shared-types';
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

/** V2 BondingCurve - TokenLaunched from factory (same event name as V1 but different signature).
 * topic0: 0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607
 * Verified on-chain: factory 0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e
 */
export const TOKEN_LAUNCHED_V2_EVENT = parseAbiItem(
  'event TokenLaunched(address indexed token, address indexed curve, address indexed creator, address pairedToken, uint256 positionId, uint256 initialBuyAmount)',
);
export const TOKEN_LAUNCHED_V2_STANDARD_EVENT = parseAbiItem(
  'event TokenLaunchedV2(address indexed token, address indexed curve, address indexed creator, string name, string symbol, uint256 initialBuy)',
);

/** V1 — TokenLaunched from factory */
const TOKEN_LAUNCHED_V1_EVENT = parseAbiItem(
  'event TokenLaunched(address indexed token, address indexed deployer, address indexed dexFactory, address pairedToken, address pool, uint256 dexId, uint256 launchConfigId, uint256 positionId, uint256 restrictionsEndBlock, uint256 initialBuyAmount)',
);

// Maximum block range per poll — keeps RPC requests under 2s
const MAX_BLOCK_RANGE = 50n;

export class EventPollerService {
  private lastPolledBlock = 0n;

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
      currentBlock = toBlock ?? (await this.client.getBlockNumber());
      let startBlock =
        fromBlock ??
        (this.lastPolledBlock > 0n ? this.lastPolledBlock + 1n : currentBlock - MAX_BLOCK_RANGE);

      if (startBlock > currentBlock) return 0;
      // Block-drop clamp: if we're more than MAX_BLOCK_RANGE behind, process the oldest batch
      // this cycle and rely on subsequent polling cycles to catch up — never silently skip ahead.
      // Capping startBlock here would cause irreversible data loss for protocols with many events.
      // The while-loop inside pollV1Launches/pollV2Launches/pollV2Trades handles batch sizes.
      // Clamp is still applied so a single getLogs call stays within provider limits.
      if (currentBlock - startBlock > MAX_BLOCK_RANGE) {
        startBlock = currentBlock - MAX_BLOCK_RANGE;
      }

      let count = 0;
      count += await this.pollV1Launches(startBlock, currentBlock);
      count += await this.pollV2Launches(startBlock, currentBlock);
      count += await this.pollV2Trades(startBlock, currentBlock);
      count += await this.pollV1Swaps(startBlock, currentBlock);

      // Advance lastPolledBlock only on success so a failed cycle retries the same range.
      this.lastPolledBlock = currentBlock;
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
    const isArc = this.network.nativeCurrency.symbol === 'USDC';
    // USDC is always $1.00 on Arc; Robinhood uses live ETH price
    const quotePriceUsd = isArc ? 1.0 : await this.priceFeed.getEthPriceUsd();

    try {
      const logs = await this.client.getLogs({
        address: curveAddresses.length === 1 ? curveAddresses[0] : curveAddresses,
        event: TRADE_EVENT,
        fromBlock: from,
        toBlock: to,
      });

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

        // spot price = ethAmount / tokenAmount (in quote asset per token)
        const priceNative = tokenAmountNum > 0 ? ethAmountNum / tokenAmountNum : 0;
        const priceUsd = priceNative * quotePriceUsd;

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

    const isArc = this.network.nativeCurrency.symbol === 'USDC';
    const quotePriceUsd = isArc ? 1.0 : await this.priceFeed.getEthPriceUsd();

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
        const pairSigned = isToken0 ? amount1 : amount0;
        const isBuy = pairSigned > 0n;

        const tokenAmountRaw = Math.abs(Number(isToken0 ? amount0 : amount1)) / 1e18;
        const wethAmountRaw = Math.abs(Number(isToken0 ? amount1 : amount0)) / 1e18;

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
}
