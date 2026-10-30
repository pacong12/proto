import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import type { PublicClient, WalletClient } from 'viem';
import { ARC_CHAIN, ROBINHOOD_CHAIN } from '@goton/shared-types';

const wallet = vi.hoisted(() => ({
  client: null as null | {
    getAddresses: () => Promise<string[]>;
    getChainId: () => Promise<number>;
  },
  status: 'success' as 'success' | 'reverted',
}));
vi.mock('../src/lib/viem-client', () => ({
  getWalletClient: vi.fn(async () => wallet.client),
  getPublicClient: vi.fn(() => ({})),
  waitForReceiptWithFallback: vi.fn(async () => ({ status: wallet.status })),
}));

const { ensureAllowance, requireConnectedWallet, runWalletAction, sendWalletTransaction } =
  await import('../src/lib/wallet-tx');

const ACCOUNT = '0x00000000000000000000000000000000000000cc';
const connect = (chainId: number) => {
  wallet.client = { getAddresses: async () => [ACCOUNT], getChainId: async () => chainId };
};

describe('requireConnectedWallet', () => {
  it('needs a connected account on the requested network', async () => {
    wallet.client = null;
    await expect(requireConnectedWallet()).rejects.toThrow('Connect your wallet first');
    connect(ARC_CHAIN.chainId);
    await expect(requireConnectedWallet(ROBINHOOD_CHAIN)).rejects.toThrow(
      `Switch your wallet to ${ROBINHOOD_CHAIN.name}`,
    );
    await expect(requireConnectedWallet(ARC_CHAIN)).resolves.toMatchObject({ account: ACCOUNT });
  });
});

describe('sendWalletTransaction', () => {
  it('returns the hash once mined and throws when it reverts', async () => {
    connect(ARC_CHAIN.chainId);
    wallet.status = 'success';
    const send = vi.fn(async () => '0xabc' as const);
    expect(await sendWalletTransaction(ARC_CHAIN, send)).toBe('0xabc');
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ account: ACCOUNT }));

    wallet.status = 'reverted';
    await expect(sendWalletTransaction(ARC_CHAIN, send)).rejects.toThrow('reverted: 0xabc');
    wallet.status = 'success';
  });
});

describe('runWalletAction', () => {
  it('tracks busy, reports errors and stays quiet on a wallet rejection', async () => {
    const state = { busy: ref(false), error: ref<string | null>(null) };
    expect(await runWalletAction(state, async () => 7)).toBe(7);
    expect(state.busy.value).toBe(false);

    expect(await runWalletAction(state, () => Promise.reject(new Error('boom')))).toBeNull();
    expect(state.error.value).toBe('boom');

    const rejected = Object.assign(new Error('User rejected the request.'), { code: 4001 });
    expect(await runWalletAction(state, () => Promise.reject(rejected))).toBeNull();
    expect(state.error.value).toBeNull();
  });
});

describe('ensureAllowance', () => {
  const base = {
    account: ACCOUNT as `0x${string}`,
    token: '0x00000000000000000000000000000000000000d1' as const,
    spender: '0x00000000000000000000000000000000000000d2' as const,
    amount: 100n,
  };

  it('approves exactly the shortfall amount, and only when needed', async () => {
    const writeContract = vi.fn(async () => '0xapprove' as const);
    const walletClient = { writeContract, chain: undefined } as unknown as WalletClient;
    const client = (allowance: bigint) =>
      ({ readContract: async () => allowance }) as unknown as PublicClient;

    await ensureAllowance({ ...base, publicClient: client(100n), walletClient });
    expect(writeContract).not.toHaveBeenCalled();

    const onSubmitted = vi.fn();
    await ensureAllowance({ ...base, publicClient: client(5n), walletClient, onSubmitted });
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'approve', args: [base.spender, 100n] }),
    );
    expect(onSubmitted).toHaveBeenCalledWith('0xapprove');
  });
});
