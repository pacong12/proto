import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ARC_NETWORK, ROBINHOOD_NETWORK } from '@goton/shared-types';
import { totalsByCurrency } from '../src/lib/currency-totals';
import { useHolderDividends } from '../src/composables/useHolderDividends';

const mocks = vi.hoisted(() => ({
  sendWalletTransaction: vi.fn(),
  resolveFeeSplitter: vi.fn(),
  readContract: vi.fn(),
}));

vi.mock('../src/lib/wallet-tx', () => ({
  isUserRejection: () => false,
  sendWalletTransaction: mocks.sendWalletTransaction,
}));

vi.mock('../src/lib/viem-client', () => ({
  getPublicClient: () => ({ readContract: mocks.readContract }),
}));

vi.mock('@goton/shared-types', async (original) => ({
  ...(await original<typeof import('@goton/shared-types')>()),
  resolveFeeSplitter: mocks.resolveFeeSplitter,
}));

describe('totalsByCurrency', () => {
  it('never adds ETH to USDC', () => {
    const totals = totalsByCurrency(
      [
        { symbol: 'ETH', raw: 10n ** 16n, decimals: 18 },
        { symbol: 'USDC', raw: 4_500_000n, decimals: 6 },
        { symbol: 'ETH', raw: 2n * 10n ** 16n, decimals: 18 },
      ],
      'ETH',
    );
    expect(totals).toEqual(['0.0300 ETH', '4.5000 USDC']);
  });

  it('leaves out currencies with nothing to claim', () => {
    const totals = totalsByCurrency(
      [
        { symbol: 'ETH', raw: 0n, decimals: 18 },
        { symbol: 'USDC', raw: 1_000_000n, decimals: 6 },
      ],
      'ETH',
    );
    expect(totals).toEqual(['1.0000 USDC']);
  });

  it('shows one zero in the active currency when there is nothing at all', () => {
    expect(totalsByCurrency([], 'USDC')).toEqual(['0.0000 USDC']);
  });

  it('keeps a tiny balance visible', () => {
    expect(
      totalsByCurrency([{ symbol: 'ETH', raw: 23n * 10n ** 12n, decimals: 18 }], 'ETH'),
    ).toEqual(['0.000023 ETH']);
  });
});

describe('useHolderDividends across chains', () => {
  const arcToken = '0x00000000000000000000000000000000000000a1' as const;
  const rhToken = '0x00000000000000000000000000000000000000b1' as const;
  const holder = '0x00000000000000000000000000000000000000c1' as const;
  const networkOf = (address: string) => (address === arcToken ? ARC_NETWORK : ROBINHOOD_NETWORK);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveFeeSplitter.mockImplementation(async (_client, network) => ({
      address: `0x${String(network.chainId).padStart(40, '0')}`,
      quoteDecimals: network.chainId === ARC_NETWORK.chainId ? 6 : 18,
    }));
    mocks.readContract.mockImplementation(async ({ address }) =>
      address === `0x${String(ARC_NETWORK.chainId).padStart(40, '0')}` ? 2_000_000n : 10n ** 15n,
    );
    mocks.sendWalletTransaction.mockResolvedValue('0xhash');
  });

  async function loaded() {
    const dividends = useHolderDividends();
    await dividends.loadDividends(
      holder,
      [
        { address: arcToken, symbol: 'ARC', name: 'Arc token' },
        { address: rhToken, symbol: 'RH', name: 'Robinhood token' },
      ],
      networkOf,
    );
    return dividends;
  }

  it('reads each token on its own chain, in its own currency', async () => {
    const { entries } = await loaded();
    expect(entries.value.map((e) => [e.tokenSymbol, e.earnedFormatted, e.currencySymbol])).toEqual([
      ['ARC', '2.0000', 'USDC'],
      ['RH', '0.0010', 'ETH'],
    ]);
  });

  it('claims everything on each token`s own chain', async () => {
    const { claimAllDividends, entries } = await loaded();
    expect(await claimAllDividends()).toHaveLength(2);
    expect(mocks.sendWalletTransaction.mock.calls.map(([network]) => network.chainId)).toEqual([
      ARC_NETWORK.chainId,
      ROBINHOOD_NETWORK.chainId,
    ]);
    expect(entries.value).toEqual([]);
  });
});
