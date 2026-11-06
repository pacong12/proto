import { describe, expect, it, vi } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import { ARC_CHAIN, ROBINHOOD_CHAIN } from '@goton/shared-types';
import { readFactoryVestingVault, validateVesting, vestingDaysToSeconds } from '../src/lib/vesting';

vi.mock('../src/lib/viem-client', () => ({
  waitForReceiptWithFallback: vi.fn(async () => ({ status: 'success', logs: [] })),
}));

const { BondingCurveChainAdapter } =
  await import('../src/chains/bonding-curve/bonding-curve.adapter');
const { InPoolV4ChainAdapter } = await import('../src/chains/v4-in-pool/v4-in-pool.adapter');

const ACCOUNT = '0x00000000000000000000000000000000000000cc' as const;
const FACTORY = '0x00000000000000000000000000000000000000fa' as const;
const VAULT = '0x00000000000000000000000000000000000000ee' as const;
const BASE = { name: 'T', symbol: 'T', logo: '', description: '', socials: {} };
const VESTING = { cliffSeconds: 30n * 86_400n, durationSeconds: 180n * 86_400n };

function network(base: typeof ROBINHOOD_CHAIN) {
  return { ...base, contracts: { ...base.contracts, factoryV2: FACTORY, factory: FACTORY } };
}

function clients() {
  const writeContract = vi.fn(async () => '0xhash' as const);
  return {
    writeContract,
    wallet: { writeContract, chain: undefined } as unknown as WalletClient,
    client: { getCode: vi.fn(async () => '0x') } as unknown as PublicClient,
  };
}

const called = (fn: ReturnType<typeof clients>['writeContract']) =>
  (fn.mock.calls as unknown as [{ functionName: string; args: unknown[] }][])[0]![0];

describe('validateVesting', () => {
  it('accepts what the vault accepts', () => {
    expect(validateVesting(0, 7)).toBeNull();
    expect(validateVesting(1460, 1460)).toBeNull();
  });

  it('refuses a duration outside 7 days to 4 years, or not whole days', () => {
    expect(validateVesting(0, 6)).toBe('duration');
    expect(validateVesting(0, 1461)).toBe('duration');
    expect(validateVesting(0, 7.5)).toBe('duration');
    expect(validateVesting(0, NaN)).toBe('duration');
  });

  it('refuses a cliff longer than the duration, negative, or not whole days', () => {
    expect(validateVesting(8, 7)).toBe('cliff');
    expect(validateVesting(-1, 7)).toBe('cliff');
    expect(validateVesting(1.5, 7)).toBe('cliff');
  });

  it('converts days to seconds', () => {
    expect(vestingDaysToSeconds(7)).toBe(604_800n);
  });
});

describe('readFactoryVestingVault', () => {
  it('returns the vault of a factory that has one', async () => {
    const client = { readContract: vi.fn(async () => VAULT) } as unknown as PublicClient;
    await expect(readFactoryVestingVault(client, FACTORY)).resolves.toBe(VAULT);
  });

  it('returns null for a factory deployed before vesting', async () => {
    const client = {
      readContract: vi.fn(async () => {
        throw new Error('reverted');
      }),
    } as unknown as PublicClient;
    await expect(readFactoryVestingVault(client, FACTORY)).resolves.toBeNull();
  });
});

describe('launching with vesting', () => {
  it('Robinhood uses the vesting launch with the schedule as its last arguments', async () => {
    const { writeContract, wallet, client } = clients();
    await new BondingCurveChainAdapter(network(ROBINHOOD_CHAIN)).launchToken(
      { ...BASE, initialBuyAmountEth: '0.01', vesting: VESTING },
      wallet,
      client,
      ACCOUNT,
    );
    const call = called(writeContract);
    expect(call.functionName).toBe('launchTokenV2WithVesting');
    expect(call.args.slice(-2)).toEqual([VESTING.cliffSeconds, VESTING.durationSeconds]);
  });

  it('Robinhood refuses vesting without an initial buy to lock', async () => {
    const { writeContract, wallet, client } = clients();
    await expect(
      new BondingCurveChainAdapter(network(ROBINHOOD_CHAIN)).launchToken(
        { ...BASE, initialBuyAmountEth: '0', vesting: VESTING },
        wallet,
        client,
        ACCOUNT,
      ),
    ).rejects.toThrow(/initial buy/);
    expect(writeContract).not.toHaveBeenCalled();
  });

  it('Robinhood keeps the plain launch without vesting', async () => {
    const { writeContract, wallet, client } = clients();
    await new BondingCurveChainAdapter(network(ROBINHOOD_CHAIN)).launchToken(
      { ...BASE, initialBuyAmountEth: '0.01' },
      wallet,
      client,
      ACCOUNT,
    );
    expect(called(writeContract).functionName).toBe('launchTokenV2');
  });

  it('Arc uses the vesting launch only when asked', async () => {
    const params = {
      ...BASE,
      initialBuyAmountEth: '10',
      buyTaxPercent: 1,
      sellTaxPercent: 1,
    };
    const vested = clients();
    await new InPoolV4ChainAdapter(network(ARC_CHAIN)).launchToken(
      { ...params, vesting: VESTING },
      vested.wallet,
      vested.client,
      ACCOUNT,
    );
    expect(called(vested.writeContract).functionName).toBe('launchTokenWithVesting');
    expect(called(vested.writeContract).args.slice(-2)).toEqual([
      VESTING.cliffSeconds,
      VESTING.durationSeconds,
    ]);

    const plain = clients();
    await new InPoolV4ChainAdapter(network(ARC_CHAIN)).launchToken(
      params,
      plain.wallet,
      plain.client,
      ACCOUNT,
    );
    expect(called(plain.writeContract).functionName).toBe('launchToken');
    expect(called(plain.writeContract).args).toHaveLength(3);
  });
});
