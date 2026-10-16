import { describe, it, expect } from 'vitest';
import {
  aggregateCandlesticks,
  computeHoldersDistribution,
} from '../src/modules/tokens/domain/services/token-aggregation.service';
import { LaunchedTokenEntity, TradeEventEntity } from '@proto/shared-types';

describe('TokenAggregationService', () => {
  describe('aggregateCandlesticks', () => {
    it('returns empty array when trades is empty', () => {
      expect(aggregateCandlesticks([])).toEqual([]);
    });

    it('buckets trades by resolution time and calculates OHLCV correctly', () => {
      const baseTime = 1700000000000;
      const trades = [
        { timestamp: baseTime + 1000, priceUsd: 1.0, wethAmount: '0.5' },
        { timestamp: baseTime + 2000, priceUsd: 1.5, wethAmount: '1.0' },
        { timestamp: baseTime + 3000, priceUsd: 0.8, wethAmount: '0.2' },
        { timestamp: baseTime + 4000, priceUsd: 1.2, wethAmount: '0.3' },
      ];

      const candles = aggregateCandlesticks(trades, 60);
      expect(candles).toHaveLength(1);
      const c = candles[0];
      expect(c.open).toBe(1.0);
      expect(c.high).toBe(1.5);
      expect(c.low).toBe(0.8);
      expect(c.close).toBe(1.2);
      expect(c.volume).toBeCloseTo(2.0, 5);
    });
  });

  describe('computeHoldersDistribution', () => {
    const mockToken: LaunchedTokenEntity = {
      address: '0x1111111111111111111111111111111111111111',
      name: 'Test Token',
      symbol: 'TEST',
      decimals: 18,
      totalSupply: '1000000000000000000000000000',
      logo: '',
      description: '',
      socials: {},
      deployer: '0x2222222222222222222222222222222222222222',
      pairedToken: '0x3333333333333333333333333333333333333333',
      poolAddress: '0x4444444444444444444444444444444444444444',
      isToken0: true,
      poolFee: 10000,
      positionId: 1n,
      restrictionsEndBlock: 100n,
      launchBlock: 98n,
      createdAt: Date.now(),
    };

    it('returns pool as sole holder when no trades or initial buy', () => {
      const holders = computeHoldersDistribution(mockToken, []);
      expect(holders).toHaveLength(1);
      expect(holders[0].address).toBe(mockToken.poolAddress);
      expect(holders[0].percent).toBe(100);
    });

    it('counts the creator launch buy from its trade, not from initialBuyAmount (quote paid)', () => {
      const tokenWithInitial = { ...mockToken, initialBuyAmount: '4500000' }; // 4.50 USDC paid
      const creatorBuy: TradeEventEntity = {
        id: 'launch',
        tokenAddress: mockToken.address,
        poolAddress: mockToken.poolAddress,
        trader: mockToken.deployer,
        isBuy: true,
        tokenAmount: '100000000.0000', // 100M tokens (10%), as stored by the indexer
        wethAmount: '4.500000',
        priceUsd: 0,
        blockNumber: 1n,
        transactionHash: '0xlaunch',
        timestamp: Date.now(),
      };
      const holders = computeHoldersDistribution(tokenWithInitial, [creatorBuy]);
      expect(holders).toHaveLength(2);
      expect(holders[0].address).toBe(mockToken.poolAddress);
      expect(holders[0].percent).toBe(90);
      expect(holders[1].address).toBe(mockToken.deployer);
      expect(holders[1].percent).toBe(10);
    });

    it('computes balances for active traders from trades history', () => {
      const trades: TradeEventEntity[] = [
        {
          id: 't1',
          tokenAddress: mockToken.address,
          poolAddress: mockToken.poolAddress,
          trader: '0x5555555555555555555555555555555555555555',
          isBuy: true,
          tokenAmount: '50000000.0000', // 50M (5%), human units as stored by the indexer
          wethAmount: '0.1',
          priceUsd: 0.5,
          blockNumber: 100n,
          transactionHash: '0xhash1',
          timestamp: Date.now(),
        },
      ];

      const holders = computeHoldersDistribution(mockToken, trades);
      expect(holders.length).toBeGreaterThanOrEqual(2);
      const traderHolder = holders.find(
        (h) => h.address.toLowerCase() === '0x5555555555555555555555555555555555555555',
      );
      expect(traderHolder).toBeDefined();
      expect(traderHolder?.percent).toBe(5);
    });
  });
});
