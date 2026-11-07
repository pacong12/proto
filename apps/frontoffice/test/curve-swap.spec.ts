import { describe, it, expect, vi } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import { executeCurveSwap } from '../src/chains/shared/curve-swap';

const TOKEN = '0x00000000000000000000000000000000000000a1' as const;
const CURVE = '0x00000000000000000000000000000000000000c1' as const;
const ACCOUNT = '0x00000000000000000000000000000000000000b1' as const;

describe('executeCurveSwap', () => {
  it('sets the buy slippage floor from the on-chain quote, not a stale estimate', async () => {
    const onChain = 1_000n * 10n ** 18n;
    const publicClient = {
      readContract: async () => [onChain, 0n],
      getTransactionReceipt: async () => ({ status: 'success', blockNumber: 1n }),
    } as unknown as PublicClient;
    const writeContract = vi.fn(async () => '0xb');
    await executeCurveSwap(
      {
        tokenAddress: TOKEN,
        curveAddress: CURVE,
        isBuy: true,
        amountInWei: 10n ** 17n,
        slippagePercent: 1,
        expectedAmountOut: 100n * 10n ** 18n, // cached price, 10x too low
      },
      { chain: undefined, writeContract } as unknown as WalletClient,
      publicClient,
      ACCOUNT,
    );
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'buy', args: [(onChain * 9_900n) / 10_000n] }),
    );
  });

  it('sets a taxed sell floor from the quote, which is already net of the sell tax', async () => {
    const netOfTax = 9n * 10n ** 15n; // getAmountOutSell takes the token's sell tax off first
    const publicClient = {
      getBalance: async () => 10n ** 18n,
      readContract: async ({ functionName }: { functionName: string }) =>
        functionName === 'allowance' ? 10n ** 30n : [netOfTax, 10n ** 13n],
      getTransactionReceipt: async () => ({ status: 'success', blockNumber: 1n }),
    } as unknown as PublicClient;
    const writeContract = vi.fn(async () => '0xs');
    await executeCurveSwap(
      {
        tokenAddress: TOKEN,
        curveAddress: CURVE,
        isBuy: false,
        amountInWei: 10n ** 21n,
        slippagePercent: 1,
        expectedAmountOut: 10n ** 16n, // an untaxed estimate would revert at 1%
      },
      { chain: undefined, writeContract } as unknown as WalletClient,
      publicClient,
      ACCOUNT,
    );
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'sell',
        args: [10n ** 21n, (netOfTax * 9_900n) / 10_000n],
      }),
    );
  });

  it('waits for the approval to be mined before sending the sell', async () => {
    const events: string[] = [];
    const publicClient = {
      getBalance: async () => 10n ** 18n,
      readContract: async ({ functionName }: { functionName: string }) => {
        if (functionName === 'allowance') return 0n;
        return [10n ** 15n, 10n ** 13n]; // getAmountOutSell: (ethOut, fee)
      },
      getTransactionReceipt: async ({ hash }: { hash: string }) => {
        events.push(`mined ${hash}`);
        return { status: 'success', blockNumber: 1n };
      },
    } as unknown as PublicClient;
    const walletClient = {
      chain: undefined,
      writeContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        events.push(`send ${functionName}`);
        return functionName === 'approve' ? '0xa' : '0xs';
      }),
    } as unknown as WalletClient;

    await executeCurveSwap(
      {
        tokenAddress: TOKEN,
        curveAddress: CURVE,
        isBuy: false,
        amountInWei: 10n ** 21n,
        slippagePercent: 1,
      },
      walletClient,
      publicClient,
      ACCOUNT,
    );

    expect(events.slice(0, 3)).toEqual(['send approve', 'mined 0xa', 'send sell']);
  });
});
