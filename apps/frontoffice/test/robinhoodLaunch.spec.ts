import { describe, expect, it, vi } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import { ROBINHOOD_CHAIN } from '@goton/shared-types';

// A receipt without logs: launchToken stops after the launch transaction, which is what we check.
vi.mock('../src/lib/viem-client', () => ({
  waitForReceiptWithFallback: vi.fn(async () => ({ status: 'success', logs: [] })),
}));

const { RobinhoodChainAdapter } = await import('../src/chains/robinhood/robinhood.adapter');

const ACCOUNT = '0x00000000000000000000000000000000000000cc' as const;
const BASE = { name: 'T', symbol: 'T', logo: '', description: '', socials: {} };

async function launch(params: Record<string, unknown>) {
  const writeContract = vi.fn(async () => '0xhash' as const);
  const adapter = new RobinhoodChainAdapter();
  Object.defineProperty(adapter, 'network', {
    value: {
      ...ROBINHOOD_CHAIN,
      contracts: {
        ...ROBINHOOD_CHAIN.contracts,
        factoryV2: '0x00000000000000000000000000000000000000fa',
      },
    },
  });
  await adapter.launchToken(
    { ...BASE, ...params } as never,
    { writeContract, chain: undefined } as unknown as WalletClient,
    {} as PublicClient,
    ACCOUNT,
  );
  return writeContract.mock.calls.map(
    (c) => (c as unknown[])[0] as { functionName: string; args: unknown[] },
  );
}

describe('RobinhoodChainAdapter.launchToken', () => {
  it('sets the creator tax inside the launch transaction', async () => {
    const calls = await launch({ buyTaxPercent: 3, sellTaxPercent: 5 });
    expect(calls).toHaveLength(1);
    expect(calls[0].functionName).toBe('launchTokenV2WithTax');
    expect(calls[0].args.at(-1)).toEqual({
      buyTaxBps: 300,
      sellTaxBps: 500,
      taxRecipient: ACCOUNT,
    });
  });

  it('uses the plain launch when there is no tax', async () => {
    const calls = await launch({});
    expect(calls.map((c) => c.functionName)).toEqual(['launchTokenV2']);
  });
});
