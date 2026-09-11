import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteTokenRepository } from '../src/modules/tokens/infrastructure/adapters/sqlite-token.repository';
import { LaunchedTokenEntity, TradeEventEntity, TokenMarketData } from '@proto/shared-types';

describe('SqliteTokenRepository', () => {
  let repository: SqliteTokenRepository;

  const sampleToken: LaunchedTokenEntity = {
    address: '0x1111111111111111111111111111111111111111',
    name: 'Proto Token',
    symbol: 'PROTO',
    decimals: 18,
    totalSupply: '1000000000000000000000000',
    logo: 'ipfs://logo-hash',
    description: 'A test token on proto launchpad',
    socials: {
      twitter: 'https://x.com/proto',
      website: 'https://proto.fun',
    },
    deployer: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    pairedToken: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    poolAddress: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    isToken0: true,
    poolFee: 10000,
    positionId: 42n,
    restrictionsEndBlock: 120n,
    launchBlock: 100n,
    createdAt: 1700000000000,
    initialBuyAmount: '50000000000000000000000', // 50K tokens = 5% of 1M total supply (1e24)
  };

  beforeEach(() => {
    repository = new SqliteTokenRepository(':memory:');
  });

  afterEach(() => {
    repository.close();
  });

  it('saves and finds token by address (case-insensitive)', async () => {
    await repository.save(sampleToken);

    const found = await repository.findByAddress(sampleToken.address);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Proto Token');
    expect(found?.symbol).toBe('PROTO');
    expect(found?.positionId).toBe(42n);
    expect(found?.restrictionsEndBlock).toBe(120n);
    expect(found?.launchBlock).toBe(100n);
    expect(found?.isToken0).toBe(true);
    expect(found?.socials.twitter).toBe('https://x.com/proto');
    expect(found?.initialBuyAmount).toBe('50000000000000000000000');

    // Case-insensitivity check
    const foundLower = await repository.findByAddress(
      sampleToken.address.toLowerCase() as `0x${string}`,
    );
    expect(foundLower).not.toBeNull();
    expect(foundLower?.address).toBe(sampleToken.address);
  });

  it('lists tokens with pagination in reverse insertion order', async () => {
    const token2: LaunchedTokenEntity = {
      ...sampleToken,
      address: '0x2222222222222222222222222222222222222222',
      name: 'Second Token',
      symbol: 'SECOND',
    };

    await repository.save(sampleToken);
    await repository.save(token2);

    const list = await repository.findAll(10, 0);
    expect(list).toHaveLength(2);
    expect(list[0].symbol).toBe('SECOND');
    expect(list[1].symbol).toBe('PROTO');

    const paged = await repository.findAll(1, 0);
    expect(paged).toHaveLength(1);
    expect(paged[0].symbol).toBe('SECOND');
  });

  it('saves and retrieves market data', async () => {
    const marketData: TokenMarketData = {
      address: sampleToken.address,
      priceInWeth: 0.0001,
      priceUsd: 0.25,
      marketCapUsd: 250000,
      fdvUsd: 250000,
      pairedPrincipalWeth: '5.0',
      graduationThresholdWeth: '24.0',
      graduationProgress: 0.2083,
      isGraduated: false,
      volume24hUsd: 12500,
    };

    await repository.saveMarketData(marketData);

    const retrieved = await repository.getMarketData(sampleToken.address);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.priceUsd).toBe(0.25);
    expect(retrieved?.volume24hUsd).toBe(12500);
    expect(retrieved?.isGraduated).toBe(false);
  });

  it('records trades and aggregates candlesticks correctly', async () => {
    const baseTime = 1700000000000;
    const trades: TradeEventEntity[] = [
      {
        id: 'trade-1',
        tokenAddress: sampleToken.address,
        poolAddress: sampleToken.poolAddress,
        trader: '0x9999999999999999999999999999999999999999',
        isBuy: true,
        tokenAmount: '1000',
        wethAmount: '0.01',
        priceUsd: 0.05,
        blockNumber: 101n,
        transactionHash: '0xabc1',
        timestamp: baseTime + 1000,
      },
      {
        id: 'trade-2',
        tokenAddress: sampleToken.address,
        poolAddress: sampleToken.poolAddress,
        trader: '0x9999999999999999999999999999999999999999',
        isBuy: true,
        tokenAmount: '2000',
        wethAmount: '0.02',
        priceUsd: 0.08,
        blockNumber: 102n,
        transactionHash: '0xabc2',
        timestamp: baseTime + 15000,
      },
      {
        id: 'trade-3',
        tokenAddress: sampleToken.address,
        poolAddress: sampleToken.poolAddress,
        trader: '0x8888888888888888888888888888888888888888',
        isBuy: false,
        tokenAmount: '500',
        wethAmount: '0.005',
        priceUsd: 0.04,
        blockNumber: 103n,
        transactionHash: '0xabc3',
        timestamp: baseTime + 30000,
      },
    ];

    for (const trade of trades) {
      await repository.saveTrade(trade);
    }

    const fetchedTrades = await repository.getTrades(sampleToken.address);
    expect(fetchedTrades).toHaveLength(3);
    // Trades in reverse chronological order
    expect(fetchedTrades[0].id).toBe('trade-3');
    expect(fetchedTrades[1].id).toBe('trade-2');
    expect(fetchedTrades[2].id).toBe('trade-1');
    expect(fetchedTrades[0].blockNumber).toBe(103n);

    // Candlestick aggregation (60s bucket)
    const candles = await repository.getCandlesticks(sampleToken.address, 60);
    expect(candles).toHaveLength(1);
    const candle = candles[0];
    expect(candle.open).toBe(0.05);
    expect(candle.high).toBe(0.08);
    expect(candle.low).toBe(0.04);
    expect(candle.close).toBe(0.04);
    expect(candle.volume).toBeCloseTo(0.035, 3);
  });

  it('paginates trades using limit and offset', async () => {
    const baseTime = 1700000000000;
    for (let i = 1; i <= 5; i++) {
      await repository.saveTrade({
        id: `page-trade-${i}`,
        tokenAddress: sampleToken.address,
        poolAddress: sampleToken.poolAddress,
        trader: '0x1234567890123456789012345678901234567890',
        isBuy: true,
        tokenAmount: '100',
        wethAmount: '0.001',
        priceUsd: 0.01,
        blockNumber: BigInt(200 + i),
        transactionHash: `0xhash${i}` as `0x${string}`,
        timestamp: baseTime + i * 1000,
      });
    }

    const page1 = await repository.getTrades(sampleToken.address, 2, 0);
    expect(page1).toHaveLength(2);
    expect(page1[0].id).toBe('page-trade-5');
    expect(page1[1].id).toBe('page-trade-4');

    const page2 = await repository.getTrades(sampleToken.address, 2, 2);
    expect(page2).toHaveLength(2);
    expect(page2[0].id).toBe('page-trade-3');
    expect(page2[1].id).toBe('page-trade-2');
  });

  it('returns realistic initial holders distribution when no onchain trade index exists', async () => {
    await repository.save(sampleToken);
    const holders = await repository.getHolders(sampleToken.address);

    // Without trades: pool + deployer (if initialBuyAmount > 0)
    expect(holders.length).toBeGreaterThanOrEqual(2);
    // Liquidity locker (Pool) should hold the remainder after deployer initial buy
    const poolHolder = holders.find(
      (h) => h.address.toLowerCase() === sampleToken.poolAddress.toLowerCase(),
    );
    expect(poolHolder).toBeDefined();
    expect(poolHolder!.percent).toBeGreaterThan(0);

    // Deployer wallet should reflect initial buy amount
    const deployerHolder = holders.find(
      (h) => h.address.toLowerCase() === sampleToken.deployer.toLowerCase(),
    );
    expect(deployerHolder).toBeDefined();
    expect(deployerHolder!.percent).toBeGreaterThan(0);

    // Sum of all holder percentages should be 100%
    const totalPercent = holders.reduce((sum, h) => sum + h.percent, 0);
    expect(Math.round(totalPercent)).toBe(100);
  });

  it('reflects active trader balances in holders distribution after trades occur', async () => {
    await repository.save(sampleToken);
    const activeBuyer = '0x7777777777777777777777777777777777777777';
    await repository.saveTrade({
      id: 'trade-buy-1',
      tokenAddress: sampleToken.address,
      poolAddress: sampleToken.poolAddress,
      trader: activeBuyer,
      isBuy: true,
      tokenAmount: '50000000000000000000000', // 50,000 tokens
      wethAmount: '0.5',
      priceUsd: 0.1,
      blockNumber: 500n,
      transactionHash: '0xhashbuy1',
      timestamp: 1700000010000,
    });

    const holders = await repository.getHolders(sampleToken.address);
    const buyerHolder = holders.find((h) => h.address.toLowerCase() === activeBuyer.toLowerCase());
    expect(buyerHolder).toBeDefined();
    expect(buyerHolder?.balance).toBe('50000000000000000000000');
  });

  it('honors limit in getHolders', async () => {
    await repository.save(sampleToken);
    // With no trades, getHolders returns pool + deployer = 2 entries.
    // Requesting limit=1 should return exactly 1.
    const holders = await repository.getHolders(sampleToken.address, 1);
    expect(holders).toHaveLength(1);
  });
});
