import { computed, ref } from 'vue';
import { readCreatorFees, supportsFeeSplitters, type CreatorFees } from '@goton/shared-types';
import { useWallet } from '@/composables/useWallet';
import { useLaunchpad } from '@/composables/useLaunchpad';
import { toast } from '@/components/ui/sonner';
import { formatDividendAmount } from '@/lib/currency-totals';
import { getPublicClient } from '@/lib/viem-client';
import type { TradePage } from './types';

/**
 * The token's creator fees on its detail page: the amount (claimable now plus the share still
 * waiting to be collected) is shown to everyone; only the creator or the fee recipient they set
 * may claim it, as the splitter itself enforces.
 */
export function useTradeCreatorFees(page: TradePage) {
  const { currentToken, tokenNetwork } = page;
  const { account } = useWallet();
  const { claimFees, error: claimError } = useLaunchpad();

  const creatorFees = ref<CreatorFees | null>(null);
  const isClaimingCreatorFees = ref(false);
  // The newest load: a slower one for the previous token must not replace it.
  let loadSeq = 0;

  const creatorFeesRaw = computed(() =>
    creatorFees.value ? creatorFees.value.accrued + creatorFees.value.pending : 0n,
  );

  const creatorFeesFormatted = computed(() =>
    creatorFees.value
      ? formatDividendAmount(creatorFeesRaw.value, creatorFees.value.quoteDecimals)
      : null,
  );

  /** The connected wallet is the creator or the creator's fee recipient. */
  const canClaimCreatorFees = computed(() => {
    const fees = creatorFees.value;
    const me = account.value?.toLowerCase();
    if (!fees || !me) return false;
    return me === fees.creator.toLowerCase() || me === fees.recipient.toLowerCase();
  });

  async function refreshCreatorFees() {
    const seq = ++loadSeq;
    const token = currentToken.value.address as `0x${string}`;
    const network = tokenNetwork.value;
    if (!token || !supportsFeeSplitters(network)) {
      creatorFees.value = null;
      return;
    }
    try {
      const fees = await readCreatorFees(getPublicClient(network.chainId), network, token);
      if (seq === loadSeq) creatorFees.value = fees;
    } catch {
      // A failed read keeps the last figure rather than showing 0.
    }
  }

  async function handleClaimCreatorFees() {
    if (!canClaimCreatorFees.value) return;
    isClaimingCreatorFees.value = true;
    try {
      const hash = await claimFees(
        currentToken.value.address as `0x${string}`,
        tokenNetwork.value.chainId,
      );
      if (hash) {
        toast.success('Creator fees claimed');
        await refreshCreatorFees();
      } else if (claimError.value) {
        toast.error('Failed to claim creator fees: ' + claimError.value);
      }
    } catch (err) {
      toast.error('Failed to claim creator fees: ' + (err as Error).message);
    } finally {
      isClaimingCreatorFees.value = false;
    }
  }

  return {
    creatorFees,
    creatorFeesFormatted,
    canClaimCreatorFees,
    isClaimingCreatorFees,
    refreshCreatorFees,
    handleClaimCreatorFees,
  };
}
