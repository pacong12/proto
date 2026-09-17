import { PublicClient, parseAbiItem } from 'viem';
import { ROBINHOOD_CHAIN, NetworkConfig, TradeEventEntity } from '@proto/shared-types';
import { TokenRepositoryPort } from '../../domain/ports/token.repository.port';
import { ChainIndexerPort } from '../../domain/ports/chain.indexer.port';
import { PriceFeedPort } from '../../domain/ports/price-feed.port';
import { CalculatePricingUseCase } from '../../application/use-cases/calculate-pricing.use-case';

export class EventPollerService {
  private lastPolledBlock = 0n;

  constructor(
    private readonly client: PublicClient,
    private readonly tokenRepository: TokenRepositoryPort,
    private readonly chainIndexer: ChainIndexerPort,
    private readonly calculatePricing: CalculatePricingUseCase,
    private readonly priceFeed: PriceFeedPort,
    private readonly network: NetworkConfig = ROBINHOOD_CHAIN,
  ) {}

  async pollEvents(fromBlock?: bigint, toBlock?: bigint): Promise<number> {
    let currentBlock = 0n;
    try {
      currentBlock = toBlock ?? (await this.client.getBlockNumber());
      let startBlock =
        fromBlock ?? (this.lastPolledBlock > 0n ? this.lastPolledBlock + 1n : currentBlock - 50n);

      if (startBlock > currentBlock) return 0;

      // Cap the query window to at most 50 blocks to prevent RPC rate-limiting (429)
      if (currentBlock - startBlock > 50n) {
        startBlock = currentBlock - 50n;
      }

      let v1Count = 0;
      if (
        this.network.contracts.factory &&
        this.network.contracts.factory !== '0x0000000000000000000000000000000000000000' &&
        this.network.contracts.factory !== this.network.contracts.factoryV2
      ) {
        // 1. Poll TokenLaunched Events (v1 Direct Pool)
        const tokenLaunchedEvent = parseAbiItem(
          'event TokenLaunched(address indexed token, address indexed deployer, address indexed dexFactory, address pairedToken, address pool, uint256 dexId, uint256 launchConfigId, uint256 positionId, uint256 restrictionsEndBlock, uint256 initialBuyAmount)',
        );

        const launchLogs = await this.client.getLogs({
          address: this.network.contracts.factory,
          event: tokenLaunchedEvent,
          fromBlock: startBlock,
          toBlock: currentBlock,
        });

        for (const log of launchLogs) {
          const tokenAddress = log.args.token as `0x${string}`;
          if (tokenAddress) {
            const tokenEntity = await this.chainIndexer.fetchLaunchedTokenFromChain(tokenAddress);
            if (tokenEntity) {
              await this.tokenRepository.save(tokenEntity);
            }
          }
        }
        v1Count = launchLogs.length;
      }

      // 1b. Poll TokenLaunchedV2 Events (v2 Bonding Curve Factory)
      let v2Count = 0;
      const factoryV2 = this.network.contracts.factoryV2 ?? this.network.contracts.factory;
      if (factoryV2 && factoryV2 !== '0x0000000000000000000000000000000000000000') {
        const tokenLaunchedV2Event = parseAbiItem(
          'event TokenLaunchedV2(address indexed token, address indexed curve, address indexed creator, string name, string symbol, uint256 initialBuy)',
        );

        const v2LaunchLogs = await this.client.getLogs({
          address: factoryV2,
          event: tokenLaunchedV2Event,
          fromBlock: startBlock,
          toBlock: currentBlock,
        });

        for (const log of v2LaunchLogs) {
          const tokenAddress = log.args.token as `0x${string}`;
          if (tokenAddress) {
            const tokenEntity = await this.chainIndexer.fetchLaunchedTokenFromChain(tokenAddress);
            if (tokenEntity) {
              await this.tokenRepository.save({
                ...tokenEntity,
                version: 'v2',
                curveAddress: (log.args.curve as `0x${string}`) || tokenEntity.curveAddress,
              });
            }
          }
        }
        v2Count = v2LaunchLogs.length;
      }

      // 2. Poll Swap Events for all indexed tokens
      const swapEvent = parseAbiItem(
        'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
      );

      const allTokens = await this.tokenRepository.findAll(100, 0);
      let tradeCount = 0;

      if (allTokens.length > 0) {
        const poolAddresses = allTokens.map((t) => t.poolAddress);
        const swapLogs = await this.client.getLogs({
          address: poolAddresses.length === 1 ? poolAddresses[0] : poolAddresses,
          event: swapEvent,
          fromBlock: startBlock,
          toBlock: currentBlock,
        });

        // Build a map from pool address to token for O(1) lookup
        const tokenByPool = new Map(allTokens.map((t) => [t.poolAddress.toLowerCase(), t]));

        // Cache block timestamps to avoid redundant RPC calls
        const blockTimestamps = new Map<bigint, number>();

        // Fetch live quote asset price (USDC = $1.00 on Arc, CoinGecko ETH on Robinhood)
        const quotePriceUsd =
          this.network.nativeCurrency.symbol === 'USDC'
            ? 1.0
            : await this.priceFeed.getEthPriceUsd();

        for (const swap of swapLogs) {
          const token = tokenByPool.get(swap.address.toLowerCase());
          if (!token) continue;

          const { sender, recipient, amount0, amount1, sqrtPriceX96 } = swap.args;
          if (amount0 === undefined || amount1 === undefined) continue;

          const isToken0 = token.isToken0;
          const pairSigned = isToken0 ? amount1 : amount0;
          const isBuy = pairSigned > 0n;

          const tokenAmountRaw = isToken0
            ? amount0 < 0n
              ? -amount0
              : amount0
            : amount1 < 0n
              ? -amount1
              : amount1;
          const wethAmountRaw = isToken0
            ? amount1 < 0n
              ? -amount1
              : amount1
            : amount0 < 0n
              ? -amount0
              : amount0;

          const marketData = this.calculatePricing.execute({
            address: token.address,
            sqrtPriceX96: sqrtPriceX96 ?? 2505414483750479299401734n,
            isToken0: token.isToken0,
            pairedPrincipalWei: 0n,
            ethPriceUsd: quotePriceUsd,
          });

          const blockNumber = swap.blockNumber ?? currentBlock;
          let timestamp = blockTimestamps.get(blockNumber);
          if (timestamp === undefined) {
            const block = await this.client.getBlock({ blockNumber });
            timestamp = Number(block.timestamp);
            blockTimestamps.set(blockNumber, timestamp);
          }

          const trade: TradeEventEntity = {
            id: `${swap.transactionHash}-${swap.logIndex}`,
            tokenAddress: token.address,
            poolAddress: token.poolAddress,
            trader: (recipient ??
              sender ??
              '0x0000000000000000000000000000000000000000') as `0x${string}`,
            isBuy,
            tokenAmount: (Number(tokenAmountRaw) / 1e18).toFixed(4),
            wethAmount: (Number(wethAmountRaw) / 1e18).toFixed(6),
            priceUsd: marketData.priceUsd,
            blockNumber,
            transactionHash: swap.transactionHash ?? '0x0',
            timestamp,
          };

          await this.tokenRepository.saveTrade(trade);
          tradeCount++;
        }
      }

      this.lastPolledBlock = currentBlock;
      return v1Count + v2Count + tradeCount;
    } catch (error) {
      const err = error as { code?: number; message?: string };
      // Gracefully handle RPC rate limits (429) without crashing or spamming
      if (err?.code === 429 || err?.message?.includes('Too Many Requests')) {
        console.warn(`[EventPoller] ${this.network.name} RPC 429 rate limit hit, advancing cursor`);
      } else {
        console.error(`[EventPoller] ${this.network.name} pollEvents failed:`, error);
      }
      // Advance cursor to current block to prevent infinite loop on the same failing range
      this.lastPolledBlock = currentBlock;
      return 0;
    }
  }
}
