import { describe, expect, it, vi } from 'vitest';
import {
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  toFunctionSelector,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { ROBINHOOD_CHAIN, launchpadV2FactoryAbi } from '@goton/shared-types';

// By default a receipt without logs: launchToken stops after the launch transaction.
const receipt = vi.hoisted(() => ({ logs: [] as unknown[] }));
vi.mock('../src/lib/viem-client', () => ({
  waitForReceiptWithFallback: vi.fn(async () => ({ status: 'success', logs: receipt.logs })),
}));

const { BondingCurveChainAdapter } =
  await import('../src/chains/bonding-curve/bonding-curve.adapter');

const ACCOUNT = '0x00000000000000000000000000000000000000cc' as const;
const BASE = { name: 'T', symbol: 'T', logo: '', description: '', socials: {} };

const TOKEN = getAddress('0x00000000000000000000000000000000000000d1');
const CURVE = getAddress('0x00000000000000000000000000000000000000d2');
const WITH_CONFIG = toFunctionSelector(
  'launchTokenV2WithConfig(string,string,string,string,string,string,string,uint256,(uint16,uint16,address),(uint16,uint16,uint16,uint16))',
).slice(2);
// Dispatcher bytecode of a factory with and without the configured launch.
const NEW_FACTORY = `0x6080${'63' + WITH_CONFIG}1461` as const;
const OLD_FACTORY = `0x6080${'63' + toFunctionSelector('launchFee()').slice(2)}1461` as const;

const launchedLog = {
  address: '0x00000000000000000000000000000000000000fa',
  topics: encodeEventTopics({
    abi: launchpadV2FactoryAbi,
    eventName: 'TokenLaunchedV2',
    args: { token: TOKEN, curve: CURVE, creator: ACCOUNT },
  }),
  data: encodeAbiParameters(
    [{ type: 'string' }, { type: 'string' }, { type: 'uint256' }],
    ['T', 'T', 0n],
  ),
};

let factoryAddress = 0;
async function launch(params: Record<string, unknown>, factoryCode?: `0x${string}`) {
  const writeContract = vi.fn(async () => '0xhash' as const);
  // A fresh factory address per test, so the cached bytecode check does not carry over.
  const factoryV2 = `0x${(0xfa00 + ++factoryAddress).toString(16).padStart(40, '0')}` as const;
  const adapter = new BondingCurveChainAdapter({
    ...ROBINHOOD_CHAIN,
    contracts: {
      ...ROBINHOOD_CHAIN.contracts,
      factoryV2,
      graduator: '0x00000000000000000000000000000000000000ab',
    },
  });
  const publicClient = factoryCode ? { getCode: vi.fn(async () => factoryCode) } : {};
  const result = await adapter.launchToken(
    { ...BASE, ...params } as never,
    { writeContract, chain: undefined } as unknown as WalletClient,
    publicClient as unknown as PublicClient,
    ACCOUNT,
  );
  return Object.assign(calls(writeContract), { result });
}

function calls(writeContract: ReturnType<typeof vi.fn>) {
  return writeContract.mock.calls.map(
    (c) => (c as unknown[])[0] as { functionName: string; address: string; args: unknown[] },
  );
}

describe('BondingCurveChainAdapter.launchToken', () => {
  it('sets the creator tax inside the launch transaction', async () => {
    const calls = await launch({ buyTaxPercent: 3, sellTaxPercent: 5 });
    expect(calls).toHaveLength(1);
    expect(calls[0].functionName).toBe('launchTokenV2WithConfig');
    expect(calls[0].args.at(-2)).toEqual({
      buyTaxBps: 300,
      sellTaxBps: 500,
      taxRecipient: ACCOUNT,
    });
    expect(calls[0].args.at(-1)).toEqual({
      holdersBps: 0,
      burnBps: 0,
      creatorBps: 0,
      liquidityBps: 0,
    });
  });

  it('records the revenue split inside the launch transaction', async () => {
    const calls = await launch({
      revenueSplit: { creator: 50, buyback: 0, holders: 50, growth: 0 },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].functionName).toBe('launchTokenV2WithConfig');
    expect(calls[0].args.at(-1)).toEqual({
      holdersBps: 5_000,
      burnBps: 0,
      creatorBps: 5_000,
      liquidityBps: 0,
    });
  });

  it('uses the plain launch when there is no tax', async () => {
    const calls = await launch({});
    expect(calls.map((c) => c.functionName)).toEqual(['launchTokenV2']);
  });

  it('uses the configured launch when the factory has it', async () => {
    const calls = await launch({ buyTaxPercent: 3 }, NEW_FACTORY);
    expect(calls.map((c) => c.functionName)).toEqual(['launchTokenV2WithConfig']);
  });

  it('falls back to follow-up transactions on a factory without the configured launch', async () => {
    receipt.logs = [launchedLog];
    try {
      const calls = await launch(
        {
          buyTaxPercent: 3,
          sellTaxPercent: 5,
          revenueSplit: { creator: 50, buyback: 0, holders: 50, growth: 0 },
        },
        OLD_FACTORY,
      );
      expect(calls.map((c) => c.functionName)).toEqual([
        'launchTokenV2',
        'setInitialTaxConfig',
        'setRevenueSplit',
      ]);
      expect(calls[1].address).toBe(TOKEN);
      expect(calls[1].args).toEqual([300, 500, ACCOUNT]);
      expect(calls[2].args).toEqual([TOKEN, 5_000, 0, 5_000, 0]);
      expect(calls.result).toMatchObject({
        tokenAddress: TOKEN,
        taxApplied: true,
        splitApplied: true,
      });
    } finally {
      receipt.logs = [];
    }
  });
});
