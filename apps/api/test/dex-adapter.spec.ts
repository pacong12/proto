import { afterAll, describe, expect, it } from 'vitest';
import { getAddress } from 'viem';
import type { LaunchedTokenEntity, TradeEventEntity } from '@goton/shared-types';
import { server } from '../src/server';
import { SqliteTokenRepository } from '../src/modules/tokens/infrastructure/adapters/sqlite-token.repository';
import {
  eventsResponse,
  latestBlockResponse,
  parsePairId,
  swapEvent,
  toUnixSeconds,
} from '../src/modules/dex/dex-screener.adapter';

// Fresh ids per run, like the other API tests.
const hex = (bytes: number) =>
  `0x${Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;

const RH_WETH = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73';
const ARC_USDC = '0x3600000000000000000000000000000000000000';

const TOKEN = hex(20);
const CURVE = hex(20);
const POOL_ID = hex(32);
const ARC_TOKEN = hex(20);
const ARC_POOL_ID = hex(32);
const TRADER = hex(20);

function token(overrides: Partial<LaunchedTokenEntity>): LaunchedTokenEntity {
  return {
    address: TOKEN,
    name: 'Prot',
    symbol: 'PROT',
    decimals: 18,
    totalSupply: '1000000000000000000000000000',
    logo: '',
    description: '',
    socials: { twitter: 'https://x.com/i/jf/onboarding', website: 'https://example.com' },
    deployer: TRADER,
    pairedToken: RH_WETH,
    poolAddress: CURVE,
    curveAddress: CURVE,
    isToken0: true,
    poolFee: 10000,
    positionId: 0n,
    restrictionsEndBlock: 0n,
    launchBlock: 100n,
    createdAt: 1_793_000_000_000,
    initialBuyAmount: '0',
    version: 'v2',
    ...overrides,
  } as LaunchedTokenEntity;
}

function trade(overrides: Partial<TradeEventEntity>): TradeEventEntity {
  return {
    id: `${hex(32)}-4`,
    tokenAddress: TOKEN,
    poolAddress: CURVE,
    trader: TRADER,
    isBuy: true,
    tokenAmount: '71298.4876',
    wethAmount: '0.000107',
    priceUsd: 0.0000035,
    blockNumber: 150n,
    transactionHash: hex(32),
    // Milliseconds, as the indexer stores them.
    timestamp: 1_793_008_621_000,
    ...overrides,
  };
}

const get = async (path: string) => {
  const res = await server.fetch(new Request(`http://localhost:3001${path}`));
  return { status: res.status, body: await res.json() };
};

describe('DEX Screener adapter mapping', () => {
  it('keeps curve addresses and v4 poolIds apart', () => {
    expect(parsePairId(CURVE)).toBe(getAddress(CURVE));
    expect(parsePairId(POOL_ID.toUpperCase().replace('0X', '0x'))).toBe(POOL_ID);
    // The old /(0x[a-f0-9]{40})/ match took the first 40 hex digits of a poolId as an address.
    expect(parsePairId(POOL_ID)).toHaveLength(66);
    expect(parsePairId(`${CURVE}00`)).toBeNull();
    expect(parsePairId('PROT')).toBeNull();
  });

  it('reports block timestamps in seconds', () => {
    expect(toUnixSeconds(1_793_008_621_000)).toBe(1_793_008_621);
    expect(toUnixSeconds(1_793_008_621)).toBe(1_793_008_621);
  });

  it('shapes /latest-block as a block object', () => {
    expect(latestBlockResponse(101_400_737n, 1_793_008_621)).toEqual({
      block: { blockNumber: 101_400_737, blockTimestamp: 1_793_008_621 },
    });
  });

  it('maps buys and sells with the token as asset0 and the quote as asset1', () => {
    const buy = swapEvent(trade({ isBuy: true }))!;
    expect(buy).toMatchObject({
      eventType: 'swap',
      asset1In: '0.000107',
      asset0Out: '71298.4876',
      txnIndex: 4,
      eventIndex: 4,
      maker: getAddress(TRADER),
      pairId: getAddress(CURVE),
      block: { blockNumber: 150, blockTimestamp: 1_793_008_621 },
    });
    expect(buy.priceNative).toBeCloseTo(0.000107 / 71298.4876, 18);
    const sell = swapEvent(trade({ isBuy: false }))!;
    expect(sell).toMatchObject({ asset0In: '71298.4876', asset1Out: '0.000107' });
    expect('asset1In' in sell || 'asset0Out' in sell).toBe(false);
  });

  it('drops events DEX Screener would reject and sorts the rest by block and log index', () => {
    const { events } = eventsResponse([
      trade({ blockNumber: 9n, id: `${hex(32)}-2` }),
      trade({ wethAmount: '0.000000' }),
      trade({ blockNumber: 8n, id: `${hex(32)}-7` }),
      trade({ blockNumber: 9n, id: `${hex(32)}-1` }),
      trade({ id: 'no-log-index' }),
    ]);
    expect(events.map((e) => [e.block.blockNumber, e.eventIndex])).toEqual([
      [8, 7],
      [9, 1],
      [9, 2],
    ]);
  });
});

describe('DEX Screener adapter endpoints across graduation and chains', () => {
  const repository = new SqliteTokenRepository();

  afterAll(() => repository.close());

  it('serves the bonding curve, then the v4 pool after TokenGraduated, as two pairs', async () => {
    await repository.save(token({}));
    await repository.saveTrade(trade({ id: `${hex(32)}-4`, blockNumber: 150n }));
    // pollGraduations: the token now trades in its v4 pool, keyed by poolId.
    await repository.save(token({ poolAddress: POOL_ID, isGraduated: true, isToken0: false }));
    await repository.saveTrade(
      trade({ id: `${hex(32)}-7`, poolAddress: POOL_ID, blockNumber: 250n, isBuy: false }),
    );
    // An Arc token whose pool lives at the same block heights must not leak into Robinhood.
    await repository.save(
      token({
        address: ARC_TOKEN,
        pairedToken: ARC_USDC,
        poolAddress: ARC_POOL_ID,
        curveAddress: undefined,
        symbol: 'ARCT',
      }),
    );
    await repository.saveTrade(
      trade({
        id: `${hex(32)}-1`,
        tokenAddress: ARC_TOKEN,
        poolAddress: ARC_POOL_ID,
        blockNumber: 200n,
      }),
    );

    const pool = await get(`/dex/robinhood/pair?id=${POOL_ID}`);
    expect(pool.status).toBe(200);
    expect(pool.body.pair).toMatchObject({
      id: POOL_ID,
      dexKey: 'goton',
      asset0Id: getAddress(TOKEN),
      asset1Id: RH_WETH,
      feeBps: 100,
      metadata: { kind: 'uniswap-v4' },
    });
    // Created at graduation, which the index does not record.
    expect(pool.body.pair.createdAtBlockNumber).toBeUndefined();

    const curve = await get(`/dex/robinhood/pair?id=${CURVE}`);
    expect(curve.status).toBe(200);
    expect(curve.body.pair).toMatchObject({
      id: getAddress(CURVE),
      metadata: { kind: 'bonding-curve' },
      createdAtBlockNumber: 100,
      createdAtBlockTimestamp: 1_793_000_000,
    });

    const all = await get('/dex/robinhood/events?fromBlock=100&toBlock=300');
    expect(all.status).toBe(200);
    expect(all.body.events.map((e: { pairId: string }) => e.pairId)).toEqual([
      getAddress(CURVE),
      POOL_ID,
    ]);
    expect(all.body.events[0].block.blockTimestamp).toBe(1_793_008_621);

    const v4Only = await get(`/dex/robinhood/events?fromBlock=100&toBlock=300&id=${POOL_ID}`);
    expect(v4Only.body.events).toHaveLength(1);
    expect(v4Only.body.events[0]).toMatchObject({ pairId: POOL_ID, eventIndex: 7 });

    const arc = await get('/dex/arc/events?fromBlock=100&toBlock=300');
    expect(arc.body.events.map((e: { pairId: string }) => e.pairId)).toEqual([ARC_POOL_ID]);
    expect((await get(`/dex/arc/pair?id=${ARC_POOL_ID}`)).body.pair.asset1Id).toBe(ARC_USDC);
    expect((await get(`/dex/robinhood/pair?id=${ARC_POOL_ID}`)).status).toBe(404);
  });

  it('serves token and quote assets with decimalized supply and no creator links', async () => {
    const asset = await get(`/dex/robinhood/asset?id=${TOKEN}`);
    expect(asset.status).toBe(200);
    expect(asset.body).toEqual({
      asset: {
        id: getAddress(TOKEN),
        name: 'Prot',
        symbol: 'PROT',
        totalSupply: '1000000000',
        circulatingSupply: '1000000000',
      },
    });
    expect((await get(`/dex/robinhood/asset?id=${RH_WETH}`)).body.asset).toEqual({
      id: RH_WETH,
      name: 'Wrapped Ether',
      symbol: 'WETH',
    });
    expect((await get(`/dex/arc/asset?id=${ARC_USDC}`)).body.asset.symbol).toBe('USDC');
  });

  it('rejects malformed requests instead of guessing', async () => {
    expect((await get('/dex/robinhood/pair?id=PROT')).status).toBe(400);
    expect((await get('/dex/robinhood/events?fromBlock=10')).status).toBe(400);
    expect((await get('/dex/robinhood/events?fromBlock=10&toBlock=5')).status).toBe(400);
    expect((await get('/dex/solana/latest-block')).status).toBe(404);
    // Without a persisted indexer cursor there is no block /events can vouch for.
    expect((await get('/dex/robinhood/latest-block')).status).toBe(503);
  });

  it('keeps the old /dex/{endpoint}?chain= paths working', async () => {
    expect((await get(`/dex/pair?id=${POOL_ID}`)).body.pair.id).toBe(POOL_ID);
    expect((await get(`/dex/pair?chain=arc&id=${ARC_POOL_ID}`)).body.pair.id).toBe(ARC_POOL_ID);
  });
});
