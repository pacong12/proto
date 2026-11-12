import { describe, expect, it } from 'vitest';
import type { TokenMarketData } from '@goton/shared-types';
import { SqliteTokenRepository } from '../src/app/storage/sqlite-token.repository';
import { CheckAlertsService, alertCrossed } from '../src/modules/alerts';

const WALLET = '0x00000000000000000000000000000000000000a1';
const TOKEN = '0x00000000000000000000000000000000000000aa';

const market = (priceUsd: number, marketCapUsd: number): TokenMarketData =>
  ({
    address: TOKEN,
    priceInWeth: 1,
    priceUsd,
    marketCapUsd,
    fdvUsd: marketCapUsd,
    pairedPrincipalWeth: '0',
    graduationThresholdWeth: '4.2',
    graduationProgress: 0,
    isGraduated: false,
    volume24hUsd: 0,
  }) as TokenMarketData;

const alert = (over: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  wallet: WALLET as `0x${string}`,
  tokenAddress: TOKEN as `0x${string}`,
  chainId: 4663,
  kind: 'price' as const,
  direction: 'above' as const,
  threshold: 1,
  status: 'open' as const,
  createdAt: Date.now(),
  triggeredAt: null,
  ...over,
});

describe('alertCrossed', () => {
  it('fires above/below the threshold only in the set direction', () => {
    expect(alertCrossed(alert({ direction: 'above', threshold: 100 }), 100)).toBe(true);
    expect(alertCrossed(alert({ direction: 'above', threshold: 100 }), 99)).toBe(false);
    expect(alertCrossed(alert({ direction: 'below', threshold: 100 }), 100)).toBe(true);
    expect(alertCrossed(alert({ direction: 'below', threshold: 100 }), 101)).toBe(false);
  });
});

describe('SqliteAlertStore + CheckAlertsService', () => {
  it('stores, lists and removes a wallet’s alerts', async () => {
    const repo = new SqliteTokenRepository(':memory:');
    const a = alert();
    await repo.savePriceAlert!(a);
    expect((await repo.listPriceAlerts!({ wallet: WALLET })).map((x) => x.id)).toEqual([a.id]);
    expect(await repo.deletePriceAlert!(a.id, '0x00000000000000000000000000000000000000ff')).toBe(
      false,
    );
    expect(await repo.deletePriceAlert!(a.id, WALLET)).toBe(true);
    expect(await repo.listPriceAlerts!({ wallet: WALLET })).toEqual([]);
    repo.close();
  });

  it('marks only the alerts whose token reached the target, once', async () => {
    const repo = new SqliteTokenRepository(':memory:');
    await repo.saveMarketData(market(2, 500_000)); // price 2, mcap 500k
    const hitPrice = alert({ kind: 'price', direction: 'above', threshold: 1.5 });
    const missPrice = alert({ kind: 'price', direction: 'above', threshold: 5 });
    const hitMcap = alert({ kind: 'mcap', direction: 'below', threshold: 1_000_000 });
    for (const a of [hitPrice, missPrice, hitMcap]) await repo.savePriceAlert!(a);

    const fired = await new CheckAlertsService(repo).runOnce();
    expect(fired).toBe(2);
    const open = await repo.listPriceAlerts!({ status: 'open' });
    expect(open.map((a) => a.id)).toEqual([missPrice.id]);
    // A second run does not re-fire the already-triggered ones.
    expect(await new CheckAlertsService(repo).runOnce()).toBe(0);
    repo.close();
  });
});

import { server } from '../src/server';

describe('alerts routes', () => {
  const post = (body: object) =>
    server.fetch(
      new Request('http://localhost:3001/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );

  it('creates an alert, lists it, and rejects bad input', async () => {
    const good = {
      wallet: WALLET,
      tokenAddress: TOKEN,
      chainId: 4663,
      kind: 'mcap',
      direction: 'above',
      threshold: 100000,
    };
    const created = await (await post(good)).json();
    expect(created.success).toBe(true);
    expect(created.data).toMatchObject({ kind: 'mcap', direction: 'above', threshold: 100000 });

    const list = await (
      await server.fetch(new Request(`http://localhost:3001/api/alerts?wallet=${WALLET}`))
    ).json();
    expect(list.success).toBe(true);
    expect(list.data.some((a: { id: string }) => a.id === created.data.id)).toBe(true);

    const bad = await post({ ...good, kind: 'nonsense' });
    expect(bad.status).toBe(400);
    const badThreshold = await post({ ...good, threshold: -5 });
    expect(badThreshold.status).toBe(400);
    const badAddr = await (await post({ ...good, wallet: '0xZZZ' })).json();
    expect(badAddr.error.code).toBe('INVALID_ADDRESS');
  });
});
