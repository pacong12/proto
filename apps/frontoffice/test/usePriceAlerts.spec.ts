import { describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ list: [] as unknown[] }));
vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn(async (path: string, opts?: { method?: string; body?: string }) => {
    if (opts?.method === 'POST') {
      const body = JSON.parse(opts.body ?? '{}');
      return { success: true, data: { id: 'a1', status: 'open', ...body } };
    }
    if (opts?.method === 'DELETE') return { success: true, data: { removed: true } };
    return { success: true, data: calls.list };
  }),
}));
vi.mock('@/lib/session', () => ({ getSessionHeaders: async () => ({ Authorization: 'Bearer x' }) }));

const { usePriceAlerts } = await import('../src/composables/usePriceAlerts');
const WALLET = '0x00000000000000000000000000000000000000a1';
const TOKEN = '0x00000000000000000000000000000000000000aa';

describe('usePriceAlerts', () => {
  it('creates an alert and prepends it to the list', async () => {
    const { alerts, create } = usePriceAlerts();
    const a = await create({
      wallet: WALLET,
      tokenAddress: TOKEN,
      chainId: 4663,
      kind: 'mcap',
      direction: 'above',
      threshold: 100000,
    });
    expect(a).toMatchObject({ id: 'a1', kind: 'mcap', direction: 'above', threshold: 100000 });
    expect(alerts.value.map((x) => x.id)).toEqual(['a1']);
  });

  it('loads a wallet’s alerts and removes one', async () => {
    calls.list = [
      { id: 'x1', tokenAddress: TOKEN, kind: 'price', status: 'open' },
      { id: 'x2', tokenAddress: TOKEN, kind: 'mcap', status: 'triggered' },
    ];
    const { alerts, load, remove } = usePriceAlerts();
    await load(WALLET);
    expect(alerts.value.map((a) => a.id)).toEqual(['x1', 'x2']);
    await remove('x1', WALLET);
    expect(alerts.value.map((a) => a.id)).toEqual(['x2']);
  });

  it('clears alerts for an empty wallet without calling the API', async () => {
    const { alerts, load } = usePriceAlerts();
    await load('');
    expect(alerts.value).toEqual([]);
  });
});
