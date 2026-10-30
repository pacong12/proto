import { describe, expect, it, vi } from 'vitest';
import { ARC_CHAIN, ROBINHOOD_CHAIN } from '@goton/shared-types';

const executeSwap = vi.fn(async () => '0xhash');
let walletChain = ARC_CHAIN.chainId;

vi.mock('../src/lib/viem-client', () => ({
  getPublicClient: () => ({ readContract: async () => 0n }),
  getWalletClient: async () => ({
    getAddresses: async () => ['0x00000000000000000000000000000000000000cc'],
    getChainId: async () => walletChain,
  }),
}));
vi.mock('../src/chains', () => ({
  getChainAdapter: () => ({
    chainId: ROBINHOOD_CHAIN.chainId,
    network: ROBINHOOD_CHAIN,
    executeSwap,
  }),
}));

const { useSwap } = await import('../src/composables/useSwap');

const params = {
  tokenAddress: '0x1234567890123456789012345678901234567890' as const,
  isBuy: true,
  amountInEth: '0.1',
  chainId: ROBINHOOD_CHAIN.chainId,
};

describe('useSwap chain guard', () => {
  it('refuses to send when the wallet is on another chain than the token', async () => {
    walletChain = ARC_CHAIN.chainId;
    const { executeSwap: swap, swapError } = useSwap();
    expect(await swap(params)).toBeNull();
    expect(executeSwap).not.toHaveBeenCalled();
    expect(swapError.value).toContain(ROBINHOOD_CHAIN.name);
  });

  it('sends when the wallet is on the token chain', async () => {
    walletChain = ROBINHOOD_CHAIN.chainId;
    const { executeSwap: swap } = useSwap();
    expect(await swap(params)).toBe('0xhash');
    expect(executeSwap).toHaveBeenCalledTimes(1);
  });
});
