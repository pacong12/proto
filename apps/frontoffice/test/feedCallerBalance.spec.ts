import { describe, expect, it, vi, beforeEach } from 'vitest';

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-client', () => ({ apiFetch }));

const { useFeed } = await import('../src/composables/useFeed');

const TOKEN = '0xd1fa6f2e9361fc317a902f8c5cd3b7a3edc879d9';
const ACCOUNT = '0xDe04BFAb42162B2a89c33d22324C980c54f9f4BE';

/** What GET /api/tokens/:address/balance returns (tokens.routes.ts). */
const balanceReply = (formatted: number) => ({
  success: true,
  data: {
    tokenAddress: TOKEN,
    account: ACCOUNT,
    chainId: 5042002,
    balanceWei: BigInt(Math.round(formatted * 1e6)) * 10n ** 12n + '',
    nativeGasWei: '0',
    decimals: 18,
    formatted,
  },
});

describe('fetchCallerBalance', () => {
  beforeEach(() => apiFetch.mockReset());

  it("reads a holder's whole-token balance, so a holder can post a call", async () => {
    apiFetch.mockResolvedValue(balanceReply(113486.6));
    const { fetchCallerBalance } = useFeed();

    expect(await fetchCallerBalance(TOKEN, ACCOUNT)).toBe(113486.6);
    expect(apiFetch).toHaveBeenCalledWith(`/api/tokens/${TOKEN}/balance?account=${ACCOUNT}`);
  });

  it('is zero for a wallet without the token, or when the API fails', async () => {
    const { fetchCallerBalance } = useFeed();
    apiFetch.mockResolvedValue(balanceReply(0));
    expect(await fetchCallerBalance(TOKEN, ACCOUNT)).toBe(0);
    apiFetch.mockResolvedValue({ success: false, data: null });
    expect(await fetchCallerBalance(TOKEN, ACCOUNT)).toBe(0);
    apiFetch.mockRejectedValueOnce(new Error('down'));
    expect(await fetchCallerBalance(TOKEN, ACCOUNT)).toBe(0);
  });
});
