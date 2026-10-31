import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryTokenRepository } from '../src/modules/tokens/infrastructure/adapters/in-memory-token.repository';
import { GetTradesUseCase } from '../src/modules/trades/application/use-cases/get-trades.use-case';
import { GetCandlesticksUseCase } from '../src/modules/trades/application/use-cases/get-candlesticks.use-case';
import { TradeEventEntity } from '@goton/shared-types';

describe('Event Indexer, Trades & Candlestick Aggregation', () => {
  let repository: InMemoryTokenRepository;

  const sampleToken = '0x1111111111111111111111111111111111111111' as `0x${string}`;
  const samplePool = '0x2222222222222222222222222222222222222222' as `0x${string}`;

  beforeEach(() => {
    repository = new InMemoryTokenRepository();
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

    // Trades without a quote price keep their recorded USD price.
    const priceFeed = { getQuoteAssetPriceUsd: async () => 3000 };
    const candles = await new GetCandlesticksUseCase(repository, priceFeed).execute(
      sampleToken,
      60,
    );
    expect(candles).toHaveLength(1);

    const candle = candles[0];
    expect(candle?.open).toBe(0.00001);
    expect(candle?.high).toBe(0.000015);
    expect(candle?.low).toBe(0.000008);
    expect(candle?.close).toBe(0.000008);
    expect(candle?.volume).toBeCloseTo(0.035, 3);
  });

  it('prices candles from the spot quote price at the quote asset USD price now', async () => {
    // A buy at a lower ETH/USD than the trade before it: still a rise, since the spot price in
    // ETH rose (3e-9 → 4e-9 ETH per token).
    const start = Math.floor(Date.now() / 60_000) * 60_000 - 600_000;
    const at = (id: string, isBuy: boolean, priceQuote: number, ethUsd: number, s: number) => ({
      id,
      tokenAddress: sampleToken,
      poolAddress: samplePool,
      trader: '0x1111111111111111111111111111111111111111' as `0x${string}`,
      isBuy,
      tokenAmount: '1000',
      wethAmount: '0.000003',
      priceUsd: priceQuote * ethUsd,
      priceQuote,
      blockNumber: 1n,
      transactionHash: `0x${id}` as `0x${string}`,
      timestamp: start + s * 1000,
    });
    await repository.saveTrade(at('q1', true, 3e-9, 2500, 0));
    await repository.saveTrade(at('q2', true, 4e-9, 1500, 120));
    const priceFeed = { getQuoteAssetPriceUsd: async () => 2000 };
    const candles = await new GetCandlesticksUseCase(repository, priceFeed).execute(
      sampleToken,
      60,
    );
    const closes = candles.filter((c) => c.volume > 0).map((c) => c.close);
    expect(closes).toEqual([3e-9 * 2000, 4e-9 * 2000]);
  });
});
