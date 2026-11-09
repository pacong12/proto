import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { ROBINHOOD_CHAIN } from '@goton/shared-types';

const CREATOR = '0x00000000000000000000000000000000000000c1';
const RECIPIENT = '0x00000000000000000000000000000000000000c2';
const VISITOR = '0x00000000000000000000000000000000000000d3';
const account = ref<string | null>(null);
const claimFees = vi.fn(async () => '0xhash');

vi.mock('@goton/shared-types', async (orig) => ({
  ...(await orig<typeof import('@goton/shared-types')>()),
  supportsFeeSplitters: () => true,
  readCreatorFees: async () => ({
    address: '0x00000000000000000000000000000000000000f1',
    quoteDecimals: 18,
    accrued: 10n ** 16n,
    pending: 2n * 10n ** 16n,
    uncollectedLpFees: 0n,
    uncollectedTax: 0n,
    creator: CREATOR,
    recipient: RECIPIENT,
  }),
}));
vi.mock('@/composables/useWallet', () => ({ useWallet: () => ({ account }) }));
vi.mock('@/composables/useLaunchpad', () => ({
  useLaunchpad: () => ({ claimFees, error: ref(null) }),
}));
vi.mock('@/lib/viem-client', () => ({ getPublicClient: () => ({}) }));
vi.mock('@/components/ui/sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('useTradeCreatorFees', () => {
  it('shows the amount to everyone and lets only the creator or recipient claim', async () => {
    const { useTradeCreatorFees } = await import('../src/composables/trade/useTradeCreatorFees');
    const page = {
      currentToken: ref({ address: '0x00000000000000000000000000000000000000aa' }),
      tokenNetwork: ref(ROBINHOOD_CHAIN),
    };
    const fees = useTradeCreatorFees(page as never);
    await fees.refreshCreatorFees();

    // Not connected: the claimable-now plus uncollected share is still shown.
    expect(fees.creatorFeesFormatted.value).toBe('0.0300');
    expect(fees.canClaimCreatorFees.value).toBe(false);

    account.value = VISITOR;
    expect(fees.canClaimCreatorFees.value).toBe(false);
    await fees.handleClaimCreatorFees();
    expect(claimFees).not.toHaveBeenCalled();

    account.value = CREATOR;
    expect(fees.canClaimCreatorFees.value).toBe(true);
    account.value = RECIPIENT.toUpperCase().replace('0X', '0x');
    expect(fees.canClaimCreatorFees.value).toBe(true);
    await fees.handleClaimCreatorFees();
    expect(claimFees).toHaveBeenCalledOnce();
  });
});
