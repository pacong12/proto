import { describe, expect, it, vi } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import { ARC_CHAIN, ROBINHOOD_CHAIN } from '@goton/shared-types';

const state = vi.hoisted(() => ({ status: 'success' as 'success' | 'reverted' }));
vi.mock('../src/lib/viem-client', () => ({
  waitForReceiptWithFallback: vi.fn(async () => ({
    status: state.status,
    blockNumber: 7n,
    logs: [],
  })),
}));
const swaps = vi.hoisted(() => ({
  executeCurveSwap: vi.fn(async (..._args: unknown[]) => '0xcurve' as const),
  executeV4RouterSwap: vi.fn(async (..._args: unknown[]) => '0xpool' as const),
}));
vi.mock('../src/chains/shared/curve-swap', () => ({
  executeCurveSwap: swaps.executeCurveSwap,
  isCurveTrade: (p: { curveAddress?: string; isGraduated?: boolean }) =>
    Boolean(p.curveAddress) && !p.isGraduated,
}));
vi.mock('../src/chains/shared/v4-swap', () => ({ executeV4RouterSwap: swaps.executeV4RouterSwap }));

const { InPoolV4ChainAdapter } = await import('../src/chains/v4-in-pool/v4-in-pool.adapter');
const { BondingCurveChainAdapter } =
  await import('../src/chains/bonding-curve/bonding-curve.adapter');

const ACCOUNT = '0x00000000000000000000000000000000000000cc' as const;
const TOKEN = '0x00000000000000000000000000000000000000d1' as const;
const LAUNCH = {
  name: 'T',
  symbol: 'T',
  logo: '',
  description: '',
  socials: {},
  initialBuyAmountEth: '4.5',
  buyTaxPercent: 2,
  sellTaxPercent: 2,
};

function launch(params: Record<string, unknown> = {}) {
  const writeContract = vi.fn(async () => '0xhash' as const);
  const adapter = new InPoolV4ChainAdapter(ARC_CHAIN);
  const result = adapter.launchToken(
    { ...LAUNCH, ...params } as never,
    { writeContract, chain: undefined } as unknown as WalletClient,
    {} as PublicClient,
    ACCOUNT,
  );
  return { result, writeContract };
}

describe('InPoolV4ChainAdapter.launchToken', () => {
  it('launches with the prebuy as value, in whole USDC units', async () => {
    state.status = 'success';
    const { result, writeContract } = launch({ initialBuyAmountEth: '4.5000004' });
    await result;
    const call = (writeContract.mock.calls[0] as unknown[])[0] as {
      functionName: string;
      value: bigint;
    };
    expect(call.functionName).toBe('launchToken');
    expect(call.value).toBe(4_500_000n * 10n ** 12n);
  });

  it('refuses a prebuy under the minimum and a launch without tax', async () => {
    await expect(launch({ initialBuyAmountEth: '1' }).result).rejects.toThrow(/prebuy/);
    await expect(launch({ buyTaxPercent: 0, sellTaxPercent: 0 }).result).rejects.toThrow(/tax/);
  });

  it('throws when the launch transaction reverts', async () => {
    state.status = 'reverted';
    await expect(launch().result).rejects.toThrow(/reverted on-chain.*Block: 7/);
    state.status = 'success';
  });
});

describe('executeSwap', () => {
  const wallet = {} as WalletClient;
  const client = {} as PublicClient;

  it('trades a token still on its curve there', async () => {
    const adapter = new InPoolV4ChainAdapter(ARC_CHAIN);
    const params = { tokenAddress: TOKEN, curveAddress: TOKEN, isGraduated: false } as never;
    expect(await adapter.executeSwap(params, wallet, client, ACCOUNT)).toBe('0xcurve');
  });

  it("pays each model's pool in its own quote", async () => {
    const params = { tokenAddress: TOKEN, isGraduated: true } as never;
    await new InPoolV4ChainAdapter(ARC_CHAIN).executeSwap(params, wallet, client, ACCOUNT);
    expect(swaps.executeV4RouterSwap.mock.calls.at(-1)?.[1]).toEqual({
      quote: ARC_CHAIN.contracts.weth,
      nativeScale: 10n ** 12n,
    });

    // The bonding-curve model first graduates the curve; with no graduator it goes straight on.
    const robinhood = new BondingCurveChainAdapter({
      ...ROBINHOOD_CHAIN,
      contracts: { ...ROBINHOOD_CHAIN.contracts, graduator: undefined },
    });
    await robinhood.executeSwap(params, wallet, client, ACCOUNT);
    expect(swaps.executeV4RouterSwap.mock.calls.at(-1)?.[1]).toEqual({
      quote: '0x0000000000000000000000000000000000000000',
      nativeScale: 1n,
    });
  });
});
