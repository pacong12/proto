import { describe, expect, it, vi } from 'vitest';
import { ARC_CHAIN, ROBINHOOD_CHAIN } from '@goton/shared-types';

const api = vi.hoisted(() => ({ result: null as unknown, fail: false }));
vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn(async () => {
    if (api.fail) throw new Error('404');
    return api.result;
  }),
}));
const chain = vi.hoisted(() => ({ reads: {} as Record<string, unknown> }));
vi.mock('@/lib/viem-client', () => ({
  getPublicClient: vi.fn(() => ({
    readContract: async ({ functionName }: { functionName: string }) => {
      if (!(functionName in chain.reads)) throw new Error(`no ${functionName}`);
      return chain.reads[functionName];
    },
  })),
}));
const shared = vi.hoisted(() => ({ launchOn: null as number | null }));
vi.mock('@goton/shared-types', async (orig) => {
  const real = await orig<typeof import('@goton/shared-types')>();
  return {
    ...real,
    findFactoryLaunch: vi.fn(async (_c: unknown, network: { chainId: number }) =>
      network.chainId === shared.launchOn
        ? {
            curve: '0x00000000000000000000000000000000000000c1',
            creator: '0x1',
            createdAt: 100n,
            graduated: false,
          }
        : null,
    ),
    readV2LaunchedToken: vi.fn(async () => ({
      address: '0x00000000000000000000000000000000000000aa',
      totalSupply: '1000000000000000000000000000',
      decimals: 18,
      virtualEthReserve: '2000000000000000000',
      virtualTokenReserve: '1000000000000000000000000000',
      initialBuyAmount: '2100000000000000000',
      graduationTarget: '4200000000000000000',
    })),
  };
});

const { fetchTradeToken } = await import('../src/composables/trade/token-source');
const { readTeamPayouts } = await import('../src/composables/useTeamFees');
const TOKEN = '0x00000000000000000000000000000000000000aa' as const;

describe('fetchTradeToken', () => {
  it('uses the API when it knows the token', async () => {
    api.fail = false;
    api.result = {
      success: true,
      data: { token: { address: TOKEN }, marketData: { priceUsd: 1 } },
    };
    expect(await fetchTradeToken(TOKEN)).toMatchObject({ marketData: { priceUsd: 1 } });
  });

  it('falls back to the chain that launched the token, with progress from 0 to 1', async () => {
    api.fail = true;
    shared.launchOn = ROBINHOOD_CHAIN.chainId;
    const data = await fetchTradeToken(TOKEN);
    expect(data?.token.address).toBe(TOKEN);
    expect(data?.marketData.graduationProgress).toBe(0.5);
    shared.launchOn = null;
    expect(await fetchTradeToken(TOKEN)).toBeNull();
  });
});

describe('readTeamPayouts', () => {
  it("reads the pool quote asset with the network's quote decimals", async () => {
    const USDC = ARC_CHAIN.contracts.weth;
    chain.reads = {
      taxConfig: [0, 0, '0x00000000000000000000000000000000000000bb'],
      quoteAsset: USDC,
      payees: ['0x00000000000000000000000000000000000000d1'],
      shareBps: 10_000,
      releasable: 5n,
    };
    const team = await readTeamPayouts(ARC_CHAIN, TOKEN, 'T');
    // No fee splitter is resolvable in this mock, so the quote stays native.
    expect(team?.assets[1]).toMatchObject({
      symbol: 'USDC',
      decimals: ARC_CHAIN.nativeCurrency.decimals,
    });
    expect(team?.members[0]).toMatchObject({ shareBps: 10_000, due: [5n, 5n] });
  });
});
