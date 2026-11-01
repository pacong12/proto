import { ref, computed } from 'vue';
import { useWallet } from '@/composables/useWallet';
import { toast } from '@/components/ui/sonner';
import { useHolderDividends, type HolderDividendEntry } from '@/composables/useHolderDividends';
import { supportsFeeSplitters } from '@goton/shared-types';
import type { TradePage } from './types';

/** Holder dividends of the connected wallet for this token. */
export function useTradeDividends(page: TradePage) {
  const { currentToken, tokenNetwork } = page;
  const { account, updateBalance } = useWallet();

  // Live Holder Dividends State (Argus style)
  const { loadSingleTokenDividend, claimDividend: claimHolderDividend } = useHolderDividends();

  const unclaimedDividend = ref<HolderDividendEntry | null>(null);

  const isClaimingDividends = ref(false);

  const isPnlModalOpen = ref(false);

  const isDividendsConfigured = computed(() => supportsFeeSplitters(tokenNetwork.value));

  const hasDividends = computed(() => {
    return (unclaimedDividend.value?.earnedWei ?? 0n) > 0n;
  });

  const unclaimedDividendFormatted = computed(() => {
    return unclaimedDividend.value?.earnedFormatted ?? '0.0000';
  });

  async function refreshLiveDividends() {
    if (!account.value || !currentToken.value.address || !isDividendsConfigured.value) {
      unclaimedDividend.value = null;
      return;
    }
    try {
      const entry = await loadSingleTokenDividend(
        account.value as `0x${string}`,
        currentToken.value.address as `0x${string}`,
        currentToken.value.symbol,
        currentToken.value.name,
        tokenNetwork.value,
      );
      unclaimedDividend.value = entry;
    } catch {
      // Non-blocking
    }
  }

  async function handleClaimDividends() {
    if (!account.value || !currentToken.value.address || !isDividendsConfigured.value) return;
    isClaimingDividends.value = true;
    try {
      const hash = await claimHolderDividend(
        currentToken.value.address as `0x${string}`,
        tokenNetwork.value,
      );
      if (hash) {
        toast.success('Dividends claimed successfully!');
        await refreshLiveDividends();
        await updateBalance(undefined, tokenNetwork.value.chainId, true);
      }
    } catch (err) {
      toast.error('Failed to claim dividends: ' + (err as Error).message);
    } finally {
      isClaimingDividends.value = false;
    }
  }

  return {
    handleClaimDividends,
    hasDividends,
    isClaimingDividends,
    isDividendsConfigured,
    isPnlModalOpen,
    refreshLiveDividends,
    unclaimedDividend,
    unclaimedDividendFormatted,
  };
}

export type UseTradeDividends = ReturnType<typeof useTradeDividends>;
