import { PublicClient } from 'viem';
import {
  ROBINHOOD_CHAIN,
  launchpadFactoryAbi,
  uniswapV3PoolAbi,
  TradeEventEntity,
} from '@proto/shared-types';
import { TokenRepositoryPort } from '../../domain/ports/token.repository.port';
import { ChainIndexerPort } from '../../domain/ports/chain.indexer.port';
import { CalculatePricingUseCase } from '../../application/use-cases/calculate-pricing.use-case';

export class EventPollerService {
  private lastPolledBlock = 0n;

  constructor(
    private readonly client: PublicClient,
    private readonly tokenRepository: TokenRepositoryPort,
    private readonly chainIndexer: ChainIndexerPort,
    private readonly calculatePricing: CalculatePricingUseCase,
  ) {}

  async pollEvents(fromBlock?: bigint, toBlock?: bigint): Promise<number> {
    try {
      const currentBlock = toBlock ?? (await this.client.getBlockNumber());
      const startBlock =
        fromBlock ?? (this.lastPolledBlock > 0n ? this.lastPolledBlock + 1n : currentBlock - 50n);

      if (startBlock > currentBlock) return 0;

      // 1. Poll TokenLaunched Events
      const launchLogs = await this.client.getLogs({
        address: ROBINHOOD_CHAIN.contracts.factory,
        event: launchpadFactoryAbi[8], // TokenLaunched event
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

      // 2. Poll Swap Events for all indexed tokens
      const allTokens = await this.tokenRepository.findAll(100, 0);
      let tradeCount = 0;

      for (const token of allTokens) {
        const swapLogs = await this.client.getLogs({
          address: token.poolAddress,
          event: uniswapV3PoolAbi[4], // Swap event
          fromBlock: startBlock,
          toBlock: currentBlock,
        });

        for (const swap of swapLogs) {
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
          });

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
            blockNumber: swap.blockNumber ?? currentBlock,
            transactionHash: swap.transactionHash ?? '0x0',
            timestamp: Date.now(),
          };

          await this.tokenRepository.saveTrade(trade);
          tradeCount++;
        }
      }

      this.lastPolledBlock = currentBlock;
      return launchLogs.length + tradeCount;
    } catch {
      return 0;
    }
  }
}
