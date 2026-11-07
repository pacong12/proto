// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { ARC_NETWORK, ROBINHOOD_NETWORK, type NetworkConfig } from '@goton/shared-types';
import type { TradePage } from '../src/composables/trade/types';

const VAULT = '0x00000000000000000000000000000000000000f1';
const WALLET = '0x00000000000000000000000000000000000000a1';

const chain = vi.hoisted(() => ({
  readVestingVault: vi.fn<(chainId: number) => Promise<string | null>>(),
}));
vi.mock('@/chains', () => ({
  getChainAdapter: (chainId: number) => ({
    readVestingVault: () => chain.readVestingVault(chainId),
  }),
}));
vi.mock('@/lib/viem-client', () => ({ getPublicClient: () => ({}) }));
vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn(async () => ({ success: true, data: [] })) }));
vi.mock('@/composables/useTokenStream', () => ({
  useTokenStream: () => ({ start: vi.fn(), stop: vi.fn(), connected: ref(false) }),
}));

const { useTradeMarket } = await import('../src/composables/trade/useTradeMarket');

function market(network: NetworkConfig = ROBINHOOD_NETWORK) {
  const tokenNetwork = ref(network);
  const page = {
    activeBottomTab: ref('trades'),
    currentMarketData: ref(null),
    currentToken: ref({ address: '0x00000000000000000000000000000000000000aa' }),
    tokenLoading: ref(false),
    tokenNetwork,
  } as unknown as TradePage;
  const result = useTradeMarket(page);
  result.holders.value = [
    { address: VAULT, percent: 20 },
    { address: WALLET, percent: 5 },
  ] as typeof result.holders.value;
  return { result, tokenNetwork };
}

describe('useTradeMarket vesting vault', () => {
  it('leaves the vault out of the wallet holder figures', async () => {
    chain.readVestingVault.mockResolvedValue(VAULT);
    const { result } = market();
    await flushPromises();
    expect(result.top10HoldingPercent.value).toBe(5);
    expect(result.holdersCount.value).toBe(1);
  });

  it('counts the row as a wallet when the vault cannot be read', async () => {
    chain.readVestingVault.mockRejectedValue(new Error('rate limited'));
    const { result } = market();
    await flushPromises();
    expect(result.top10HoldingPercent.value).toBe(25);
  });

  it('reads the vault of the chain the token moved to, ignoring the late answer', async () => {
    let answerFirst: (vault: string | null) => void = () => {};
    chain.readVestingVault.mockImplementationOnce(
      () => new Promise((resolve) => (answerFirst = resolve)),
    );
    chain.readVestingVault.mockResolvedValueOnce(null);
    const { result, tokenNetwork } = market();
    tokenNetwork.value = ARC_NETWORK;
    await flushPromises();
    answerFirst(VAULT);
    await flushPromises();
    expect(chain.readVestingVault).toHaveBeenLastCalledWith(ARC_NETWORK.chainId);
    expect(result.top10HoldingPercent.value).toBe(25);
  });
});
