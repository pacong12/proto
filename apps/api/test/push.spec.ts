import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { PriceAlert } from '@goton/shared-types';
import { SqliteTokenRepository } from '../src/app/storage/sqlite-token.repository';
import { PushSender } from '../src/modules/push';

const sent: unknown[] = [];
let nextError: { statusCode: number } | null = null;

vi.mock('web-push', () => ({
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(async (sub: unknown, body: unknown) => {
    if (nextError) {
      const e = nextError;
      nextError = null;
      throw e;
    }
    sent.push({ sub, body });
    return { statusCode: 201 };
  }),
}));

const WALLET = '0x00000000000000000000000000000000000000a1';
const sub = (endpoint: string) => ({
  endpoint,
  wallet: WALLET,
  p256dh: 'p',
  auth: 'a',
  createdAt: Date.now(),
});

describe('push subscriptions store', () => {
  it('saves, lists per wallet, upserts by endpoint, and deletes', async () => {
    const repo = new SqliteTokenRepository(':memory:');
    await repo.savePushSubscription!(sub('https://push.example/1'));
    await repo.savePushSubscription!(sub('https://push.example/2'));
    // Re-registering the same endpoint keeps one row.
    await repo.savePushSubscription!(sub('https://push.example/1'));

    const list = await repo.listPushSubscriptionsByWallet!(WALLET);
    expect(list).toHaveLength(2);
    expect(list.every((s) => s.wallet === WALLET.toLowerCase())).toBe(true);

    expect(await repo.deletePushSubscription!('https://push.example/1')).toBe(true);
    expect(await repo.listPushSubscriptionsByWallet!(WALLET)).toHaveLength(1);
    expect(await repo.deletePushSubscription!('https://push.example/nope')).toBe(false);
  });
});

describe('PushSender', () => {
  beforeEach(() => {
    sent.length = 0;
    nextError = null;
  });

  it('is a no-op when VAPID keys are unset', async () => {
    const repo = new SqliteTokenRepository(':memory:');
    await repo.savePushSubscription!(sub('https://push.example/1'));
    const sender = new PushSender(repo, {});
    expect(sender.enabled).toBe(false);
    expect(await sender.sendToWallet(WALLET, { title: 't', body: 'b', url: '/' })).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('sends to every subscription when enabled', async () => {
    const repo = new SqliteTokenRepository(':memory:');
    await repo.savePushSubscription!(sub('https://push.example/1'));
    await repo.savePushSubscription!(sub('https://push.example/2'));
    const sender = new PushSender(repo, { publicKey: 'pub', privateKey: 'priv' });
    expect(sender.enabled).toBe(true);
    expect(await sender.sendToWallet(WALLET, { title: 't', body: 'b', url: '/' })).toBe(2);
    expect(sent).toHaveLength(2);
  });

  it('prunes a subscription the push service reports as gone (410)', async () => {
    const repo = new SqliteTokenRepository(':memory:');
    await repo.savePushSubscription!(sub('https://push.example/gone'));
    const sender = new PushSender(repo, { publicKey: 'pub', privateKey: 'priv' });
    nextError = { statusCode: 410 };
    await sender.sendToWallet(WALLET, { title: 't', body: 'b', url: '/' });
    expect(await repo.listPushSubscriptionsByWallet!(WALLET)).toHaveLength(0);
  });

  it('notifyAlert builds a token-link notification', async () => {
    const repo = new SqliteTokenRepository(':memory:');
    await repo.savePushSubscription!(sub('https://push.example/1'));
    const sender = new PushSender(repo, { publicKey: 'pub', privateKey: 'priv' });
    const alert = {
      id: '1',
      wallet: WALLET as `0x${string}`,
      tokenAddress: '0x00000000000000000000000000000000000000aa' as `0x${string}`,
      chainId: 4663,
      kind: 'mcap',
      direction: 'above',
      threshold: 50000,
      status: 'triggered',
      createdAt: Date.now(),
      triggeredAt: Date.now(),
    } as PriceAlert;
    await sender.notifyAlert(alert, 'ABC');
    expect(sent).toHaveLength(1);
    const body = JSON.parse((sent[0] as { body: string }).body);
    expect(body.url).toBe('/token/0x00000000000000000000000000000000000000aa');
    expect(body.body).toContain('$ABC');
  });
});
