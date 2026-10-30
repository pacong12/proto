import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryTokenRepository } from '../src/modules/tokens/infrastructure/adapters/in-memory-token.repository';
import { CalculatePricingUseCase } from '../src/modules/tokens/application/use-cases/calculate-pricing.use-case';
import { GetTokensUseCase } from '../src/modules/tokens/application/use-cases/get-tokens.use-case';
import { GetTokenByAddressUseCase } from '../src/modules/tokens/application/use-cases/get-token-by-address.use-case';
import { GetTradesUseCase } from '../src/modules/trades/application/use-cases/get-trades.use-case';
import { TokenController } from '../src/modules/tokens/presentation/token.controller';
import { GetCandlesticksUseCase } from '../src/modules/trades/application/use-cases/get-candlesticks.use-case';
import { CoinGeckoPriceFeedAdapter } from '../src/modules/tokens/infrastructure/adapters/coingecko-price-feed.adapter';
import type { ViemChainIndexerAdapter } from '../src/modules/tokens/infrastructure/adapters/viem-chain-indexer.adapter';
import { TradeEventEntity } from '@goton/shared-types';

// Minimal stub: only covers methods called by GetTokenByAddressUseCase for v1 tokens
const stubIndexer = {
  async fetchLaunchedTokenFromChain() {
    return null;
  },
  async fetchV2CurveState() {
    return {
      totalEthRaised: 0n,
      virtualEthReserve: 3n * 10n ** 18n,
      virtualTokenReserve: 1_000_000_000n * 10n ** 18n,
      graduationTarget: 4_200n * 10n ** 15n,
      graduated: false,
    };
  },
  async fetchGraduationStatus() {
    return { pairedPrincipal: 0n, threshold: 4200000000000000000n, graduated: false, progress: 0 };
  },
  async fetchPoolSlot0() {
    return { sqrtPriceX96: 2505414483750479299401734n, tick: 0 };
  },
  async fetchWethBalance() {
    return 0n;
  },
} satisfies Partial<ViemChainIndexerAdapter>;

describe('Event Indexer, Trades & Candlestick Aggregation', () => {
  let repository: InMemoryTokenRepository;
  let calculatePricing: CalculatePricingUseCase;
  let getTokensUseCase: GetTokensUseCase;
  let getTokenByAddressUseCase: GetTokenByAddressUseCase;
  let controller: TokenController;
  let priceFeed: CoinGeckoPriceFeedAdapter;

  const sampleToken = '0x1111111111111111111111111111111111111111' as `0x${string}`;
  const samplePool = '0x2222222222222222222222222222222222222222' as `0x${string}`;

  beforeEach(() => {
    repository = new InMemoryTokenRepository();
    calculatePricing = new CalculatePricingUseCase();
    priceFeed = new CoinGeckoPriceFeedAdapter({ initialPrice: 2500 });
    getTokensUseCase = new GetTokensUseCase(repository);
    getTokenByAddressUseCase = new GetTokenByAddressUseCase(
      repository,
      stubIndexer as unknown as ViemChainIndexerAdapter,
      calculatePricing,
      priceFeed,
    );
    controller = new TokenController(getTokensUseCase, getTokenByAddressUseCase, repository);
  });

  it('records and retrieves trade events in reverse chronological order', async () => {
    const trade1: TradeEventEntity = {
      id: 'tx-1-0',
      tokenAddress: sampleToken,
      poolAddress: samplePool,
      trader: '0x1111111111111111111111111111111111111111',
      isBuy: true,
      tokenAmount: '10000',
      wethAmount: '0.05',
      priceUsd: 0.000015,
      blockNumber: 100n,
      transactionHash: '0xabc1',
      timestamp: 1000000,
    };

    const trade2: TradeEventEntity = {
      id: 'tx-2-0',
      tokenAddress: sampleToken,
      poolAddress: samplePool,
      trader: '0x2222222222222222222222222222222222222222',
      isBuy: false,
      tokenAmount: '5000',
      wethAmount: '0.025',
      priceUsd: 0.000016,
      blockNumber: 101n,
      transactionHash: '0xabc2',
      timestamp: 1000050,
    };

    await repository.saveTrade(trade1);
    await repository.saveTrade(trade2);

    const trades = await new GetTradesUseCase(repository).execute(sampleToken);
    expect(trades).toHaveLength(2);
    expect(trades[0].id).toBe('tx-2-0');
    expect(trades[1].id).toBe('tx-1-0');
  });

  it('aggregates trades into OHLCV candlesticks correctly', async () => {
    const baseTime = Math.floor(1700000000000 / 60000) * 60000;
    const trades: TradeEventEntity[] = [
      {
        id: 't1',
        tokenAddress: sampleToken,
        poolAddress: samplePool,
        trader: '0x1111111111111111111111111111111111111111',
        isBuy: true,
        tokenAmount: '1000',
        wethAmount: '0.01',
        priceUsd: 0.00001,
        blockNumber: 1n,
        transactionHash: '0x1',
        timestamp: baseTime + 5000, // 5s into 1m candle
      },
      {
        id: 't2',
        tokenAddress: sampleToken,
        poolAddress: samplePool,
        trader: '0x1111111111111111111111111111111111111111',
        isBuy: true,
        tokenAmount: '2000',
        wethAmount: '0.02',
        priceUsd: 0.000015,
        blockNumber: 2n,
        transactionHash: '0x2',
        timestamp: baseTime + 20000, // 20s
      },
      {
        id: 't3',
        tokenAddress: sampleToken,
        poolAddress: samplePool,
        trader: '0x1111111111111111111111111111111111111111',
        isBuy: false,
        tokenAmount: '500',
        wethAmount: '0.005',
        priceUsd: 0.000008,
        blockNumber: 3n,
        transactionHash: '0x3',
        timestamp: baseTime + 40000, // 40s
      },
    ];

    for (const t of trades) {
      await repository.saveTrade(t);
    }

    const candles = await new GetCandlesticksUseCase(repository).execute(sampleToken, 60);
    expect(candles).toHaveLength(1);

    const candle = candles[0];
    expect(candle?.open).toBe(0.00001);
    expect(candle?.high).toBe(0.000015);
    expect(candle?.low).toBe(0.000008);
    expect(candle?.close).toBe(0.000008);
    expect(candle?.volume).toBeCloseTo(0.035, 3);
  });
});
