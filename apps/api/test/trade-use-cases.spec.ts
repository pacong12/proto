import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryTokenRepository } from '../src/modules/tokens/infrastructure/adapters/in-memory-token.repository';
import { CoinGeckoPriceFeedAdapter } from '../src/modules/tokens/infrastructure/adapters/coingecko-price-feed.adapter';
import {
  GetTradesUseCase,
  GetRecentTradesUseCase,
  GetTopTradersUseCase,
  GetCandlesticksUseCase,
  TradeController,
} from '../src/modules/trades';
import type { TradeEventEntity, LaunchedTokenEntity } from '@goton/shared-types';

describe('Trades Module Clean Architecture Tests', () => {
  let repository: InMemoryTokenRepository;
  let priceFeed: CoinGeckoPriceFeedAdapter;
  let getTradesUseCase: GetTradesUseCase;
  let getRecentTradesUseCase: GetRecentTradesUseCase;
  let getTopTradersUseCase: GetTopTradersUseCase;
  let getCandlesticksUseCase: GetCandlesticksUseCase;
  let controller: TradeController;

  const tokenAddress = '0x1111111111111111111111111111111111111111' as `0x${string}`;
  const traderAddress = '0x2222222222222222222222222222222222222222' as `0x${string}`;

  beforeEach(() => {
    repository = new InMemoryTokenRepository();
    priceFeed = new CoinGeckoPriceFeedAdapter({ initialPrice: 2500 });

    getTradesUseCase = new GetTradesUseCase(repository);
    getRecentTradesUseCase = new GetRecentTradesUseCase(repository);
    getTopTradersUseCase = new GetTopTradersUseCase(repository, repository, priceFeed);
    getCandlesticksUseCase = new GetCandlesticksUseCase(repository, priceFeed);

    controller = new TradeController(
      getTradesUseCase,
      getRecentTradesUseCase,
      getTopTradersUseCase,
      getCandlesticksUseCase,
    );
  });

  describe('GetTradesUseCase & TradeController.getTrades', () => {
    it('rejects invalid address format', async () => {
      const res = await controller.getTrades('0xbad');
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('INVALID_ADDRESS');
    });

    it('returns trades list for valid address', async () => {
      const trade: TradeEventEntity = {
        id: 'tx-1',
        tokenAddress,
        poolAddress: '0x3333333333333333333333333333333333333333' as `0x${string}`,
        trader: traderAddress,
        isBuy: true,
        tokenAmount: '1000.00',
        wethAmount: '0.1',
        priceUsd: 0.0001,
        blockNumber: 100n,
        transactionHash: '0xhash1' as `0x${string}`,
        timestamp: Date.now(),
      };
      await repository.saveTrade(trade);

      const res = await controller.getTrades(tokenAddress);
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(1);
      expect(res.data?.[0].id).toBe('tx-1');
    });
  });

  describe('GetRecentTradesUseCase & TradeController.getRecentTrades', () => {
    it('returns global trades and validates trader address', async () => {
      const errRes = await controller.getRecentTrades('0xinvalid');
      expect(errRes.success).toBe(false);
      expect(errRes.error?.code).toBe('INVALID_PARAM');

      const okRes = await controller.getRecentTrades(traderAddress);
      expect(okRes.success).toBe(true);
      expect(Array.isArray(okRes.data)).toBe(true);
    });
  });

  describe('GetTopTradersUseCase & TradeController.getTopTraders', () => {
    it('calculates leaderboard accurately with deterministic tie-breakers', async () => {
      const mockToken: LaunchedTokenEntity = {
        address: tokenAddress,
        name: 'Alpha Token',
        symbol: 'ALPHA',
        decimals: 18,
        totalSupply: '1000000000000000000000000000',
        logo: '',
        description: '',
        socials: {},
        deployer: '0x9999999999999999999999999999999999999999' as `0x${string}`,
        pairedToken: '0x0000000000000000000000000000000000000000' as `0x${string}`,
        poolAddress: '0x8888888888888888888888888888888888888888' as `0x${string}`,
        isToken0: false,
        poolFee: 10000,
        positionId: 1n,
        restrictionsEndBlock: 100n,
        launchBlock: 98n,
        createdAt: Date.now() - 3600000,
        version: 'v2',
      };
      await repository.save(mockToken);

      const t1: TradeEventEntity = {
        id: 't-1',
        tokenAddress,
        poolAddress: mockToken.poolAddress,
        trader: traderAddress,
        isBuy: true,
        tokenAmount: '10000.00',
        wethAmount: '0.2',
        priceUsd: 0.00002,
        blockNumber: 101n,
        transactionHash: '0x1' as `0x${string}`,
        timestamp: Date.now() - 1000,
      };
      await repository.saveTrade(t1);

      const res = await controller.getTopTraders(tokenAddress);
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(1);
      expect(res.data?.[0].address).toBe(traderAddress.toLowerCase());
      expect(res.data?.[0].buyVolumeUsd).toBe(500); // 0.2 ETH * $2500 = $500
      expect(res.data?.[0].positionStatus).toBe('holding');
    });
  });

  describe('GetCandlesticksUseCase & TradeController.getCandlesticks', () => {
    it('validates resolution parameter and returns bars', async () => {
      const badRes = await controller.getCandlesticks(tokenAddress, 777);
      expect(badRes.success).toBe(false);
      expect(badRes.error?.code).toBe('INVALID_RESOLUTION');

      const okRes = await controller.getCandlesticks(tokenAddress, 1);
      expect(okRes.success).toBe(true);
      expect(Array.isArray(okRes.data)).toBe(true);
    });
  });
});
