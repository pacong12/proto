import { describe, it, expect, vi } from 'vitest';
import { BaseError, HttpRequestError } from 'viem';
import type { PublicClient, WalletClient } from 'viem';
import type { NetworkConfig } from '@goton/shared-types';
import { executeV4RouterSwap, type V4QuoteConfig } from '../src/chains/shared/v4-swap';

const TOKEN = '0x00000000000000000000000000000000000000a1' as const;
const ACCOUNT = '0x00000000000000000000000000000000000000b1' as const;
const ROUTER = '0x00000000000000000000000000000000000000c1' as const;
const NETWORK = {
  name: 'Test',
  contracts: { memeHook: '0x00000000000000000000000000000000000000d1', router: ROUTER },
} as unknown as NetworkConfig;

/** 6-dp USDC behind an 18-dp native balance, as on Arc. */
const ARC: V4QuoteConfig = {
  quote: '0x3600000000000000000000000000000000000000',
  nativeScale: 10n ** 12n,
};
/** Native ETH, as on Robinhood. */
const ROBINHOOD: V4QuoteConfig = {
  quote: '0x0000000000000000000000000000000000000000',
  nativeScale: 1n,
};

const MIN_OUT_ARG = 3;

function clients(simulate: () => Promise<{ result: bigint }>, allowance = 10n ** 30n) {
  const events: string[] = [];
  const simulateContract = vi.fn(async (_request: { args: readonly unknown[]; value?: bigint }) => {
    events.push('simulate');
    return simulate();
  });
  const writeContract = vi.fn(
    async (request: { functionName: string; args: readonly unknown[]; value?: bigint }) => {
      events.push(`send ${request.functionName}`);
      return '0xabc';
    },
  );
  const publicClient = {
    simulateContract,
    readContract: async () => allowance,
    estimateContractGas: async () => 100_000n,
    getTransactionReceipt: async () => ({ status: 'success', blockNumber: 1n }),
  } as unknown as PublicClient;
  const walletClient = { chain: undefined, writeContract } as unknown as WalletClient;
  return { events, simulateContract, writeContract, publicClient, walletClient };
}

const swap = (
  quote: V4QuoteConfig,
  c: ReturnType<typeof clients>,
  params: Partial<Parameters<typeof executeV4RouterSwap>[2]> & { isBuy: boolean },
) =>
  executeV4RouterSwap(
    NETWORK,
    quote,
    { tokenAddress: TOKEN, amountInWei: 10n ** 18n, slippagePercent: 1, ...params },
    c.walletClient,
    c.publicClient,
    ACCOUNT,
  );

const revert = () =>
  Promise.reject(Object.assign(new BaseError('execution reverted'), { name: 'Reverted' }));
const rpcDown = () =>
  Promise.reject(new HttpRequestError({ url: 'https://rpc.test', details: 'fetch failed' }));

describe('executeV4RouterSwap floor', () => {
  it('taxed pool buy on Arc: floor from the simulated output, not the untaxed estimate', async () => {
    const out = 380_427n * 10n ** 18n; // about 4% below the estimate: tax and LP fee
    const c = clients(async () => ({ result: out }));
    await swap(ARC, c, { isBuy: true, expectedAmountOut: 396_306n * 10n ** 18n });

    const simulated = c.simulateContract.mock.calls[0][0];
    expect(simulated.args[2]).toBe(10n ** 6n); // the router takes 6-dp USDC...
    expect(simulated.value).toBe(10n ** 18n); // ...paid with the 18-dp native balance
    expect(simulated.args[MIN_OUT_ARG]).toBe(0n);
    const sent = c.writeContract.mock.calls[0][0];
    expect(sent.args[MIN_OUT_ARG]).toBe((out * 9_900n) / 10_000n);
    expect(sent.value).toBe(10n ** 18n);
  });

  it('taxed pool buy on Robinhood: 18-dp input, floor from the simulated output', async () => {
    const out = 5_000n * 10n ** 18n;
    const c = clients(async () => ({ result: out }));
    await swap(ROBINHOOD, c, { isBuy: true, amountInWei: 10n ** 16n });

    expect(c.simulateContract.mock.calls[0][0].args[2]).toBe(10n ** 16n);
    const sent = c.writeContract.mock.calls[0][0];
    expect(sent.args[2]).toBe(10n ** 16n);
    expect(sent.args[MIN_OUT_ARG]).toBe((out * 9_900n) / 10_000n);
    expect(sent.value).toBe(10n ** 16n);
  });

  it('taxed pool sell on Arc: the simulated output is already in 6-dp USDC', async () => {
    const out = 970_000n; // 0.97 USDC
    const c = clients(async () => ({ result: out }));
    await swap(ARC, c, { isBuy: false, expectedAmountOut: 10n ** 18n });

    const sent = c.writeContract.mock.calls[0][0];
    expect(sent.args[MIN_OUT_ARG]).toBe(960_300n);
    expect(sent.value).toBe(0n);
  });

  it('taxed pool sell on Robinhood: floor in wei', async () => {
    const out = 97n * 10n ** 16n;
    const c = clients(async () => ({ result: out }));
    await swap(ROBINHOOD, c, { isBuy: false });
    expect(c.writeContract.mock.calls[0][0].args[MIN_OUT_ARG]).toBe((out * 9_900n) / 10_000n);
  });

  it('approves a sell before simulating it', async () => {
    const c = clients(async () => ({ result: 970_000n }), 0n);
    await swap(ARC, c, { isBuy: false });
    expect(c.events).toEqual(['send approve', 'simulate', 'send swapExactIn']);
  });

  it('retries the simulation while a public RPC catches up with a fresh approval', async () => {
    let calls = 0;
    const c = clients(() => (++calls === 1 ? revert() : Promise.resolve({ result: 970_000n })), 0n);
    await swap(ARC, c, { isBuy: false });
    expect(c.events).toEqual(['send approve', 'simulate', 'simulate', 'send swapExactIn']);
  });

  it('an explicit minimum wins over the quote', async () => {
    const c = clients(async () => ({ result: 10n ** 30n }));
    await swap(ARC, c, { isBuy: true, amountOutMinimum: 123n });
    expect(c.simulateContract).not.toHaveBeenCalled();
    expect(c.writeContract.mock.calls[0][0].args[MIN_OUT_ARG]).toBe(123n);
  });

  it('an explicit sell minimum still converts from native to quote units', async () => {
    const c = clients(async () => ({ result: 10n ** 30n }));
    await swap(ARC, c, { isBuy: false, amountOutMinimum: 5n * 10n ** 18n });
    expect(c.writeContract.mock.calls[0][0].args[MIN_OUT_ARG]).toBe(5_000_000n);
  });

  it('does not send a swap that simulates as a revert, even with an estimate', async () => {
    const c = clients(revert);
    await expect(swap(ARC, c, { isBuy: true, expectedAmountOut: 10n ** 18n })).rejects.toThrow(
      /would fail on-chain/,
    );
    expect(c.writeContract).not.toHaveBeenCalled();
  });

  it('falls back on the estimate only when the RPC cannot answer, slippage applied', async () => {
    const c = clients(rpcDown);
    await swap(ARC, c, { isBuy: false, expectedAmountOut: 10n ** 18n });
    expect(c.writeContract.mock.calls[0][0].args[MIN_OUT_ARG]).toBe(990_000n);
  });

  it('never sends a zero floor when the quote fails and there is no estimate', async () => {
    const c = clients(rpcDown);
    await expect(swap(ARC, c, { isBuy: true })).rejects.toThrow(/estimate unavailable/);
    expect(c.writeContract).not.toHaveBeenCalled();
  });

  it('never sends a zero floor when the quote is zero', async () => {
    const c = clients(async () => ({ result: 0n }));
    await expect(swap(ARC, c, { isBuy: true, expectedAmountOut: 10n ** 18n })).rejects.toThrow();
    expect(c.writeContract).not.toHaveBeenCalled();
  });

  it('never sends a zero floor when slippage or units round it down to nothing', async () => {
    const dust = clients(async () => ({ result: 1n }));
    await expect(swap(ARC, dust, { isBuy: false })).rejects.toThrow(/too small/);
    expect(dust.writeContract).not.toHaveBeenCalled();

    const estimate = clients(rpcDown);
    await expect(
      swap(ARC, estimate, { isBuy: false, expectedAmountOut: 10n ** 6n }),
    ).rejects.toThrow(/too small/);
    expect(estimate.writeContract).not.toHaveBeenCalled();
  });
});
