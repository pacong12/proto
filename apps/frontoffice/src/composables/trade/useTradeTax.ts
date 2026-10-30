import { ref } from 'vue';
import { useWallet } from '@/composables/useWallet';
import { useLaunchpad } from '@/composables/useLaunchpad';
import { useTaxConfig } from '@/composables/useTaxConfig';
import { getPublicClient } from '@/lib/viem-client';
import { toast } from '@/components/ui/sonner';
import { launchpadTokenAbi } from '@goton/shared-types';
import type { TradePage } from './types';

/** The token's creator tax: on-chain config, the proposal timelock, and the creator's edits. */
export function useTradeTax(page: TradePage) {
  const { currentToken, tokenNetwork } = page;
  const { account } = useWallet();

  const { setTokenTax } = useLaunchpad();

  const {
    pending: pendingTax,
    hasPending: hasPendingTax,
    isReady: taxIsReady,
    secondsUntilReady: taxSecondsUntilReady,
    actionLoading: taxActionLoading,
    error: taxError,
    loadPendingTax,
    acceptTaxConfig,
    cancelTaxConfig,
  } = useTaxConfig();

  async function handleAcceptTax() {
    const hash = await acceptTaxConfig(currentToken.value.address, tokenNetwork.value.chainId);
    if (hash) {
      toast.success('Tax configuration applied onchain');
      await loadOnchainTax(currentToken.value.address);
    } else if (taxError.value) {
      toast.error('Failed to apply tax config: ' + taxError.value);
    }
  }

  async function handleCancelTax() {
    const hash = await cancelTaxConfig(currentToken.value.address, tokenNetwork.value.chainId);
    if (hash) {
      toast.success('Tax proposal cancelled');
    } else if (taxError.value) {
      toast.error('Failed to cancel tax proposal: ' + taxError.value);
    }
  }

  const onchainTaxConfig = ref({
    buyTaxBps: 0,
    sellTaxBps: 0,
    taxRecipient: '',
  });

  const taxModalOpen = ref(false);

  const editBuyTax = ref('1');

  const editSellTax = ref('1');

  const editTaxRecipient = ref('');

  const updatingTax = ref(false);

  async function loadOnchainTax(tokenAddr: `0x${string}`) {
    try {
      const client = getPublicClient(tokenNetwork.value.chainId);
      const cfg = (await client.readContract({
        address: tokenAddr,
        abi: launchpadTokenAbi,
        functionName: 'taxConfig',
      })) as [number, number, string];
      if (cfg && (Number(cfg[0]) > 0 || Number(cfg[1]) > 0)) {
        onchainTaxConfig.value = {
          buyTaxBps: Number(cfg[0]),
          sellTaxBps: Number(cfg[1]),
          taxRecipient: cfg[2],
        };
        editBuyTax.value = String(Number(cfg[0]) / 100);
        editSellTax.value = String(Number(cfg[1]) / 100);
        editTaxRecipient.value = cfg[2];
      } else if (
        currentToken.value?.taxConfig?.buyTaxBps ||
        currentToken.value?.taxConfig?.sellTaxBps
      ) {
        const fallbackBuy = currentToken.value.taxConfig.buyTaxBps ?? 0;
        const fallbackSell = currentToken.value.taxConfig.sellTaxBps ?? 0;
        const fallbackRecipient = currentToken.value.taxConfig.taxRecipient || cfg?.[2] || '';
        onchainTaxConfig.value = {
          buyTaxBps: fallbackBuy,
          sellTaxBps: fallbackSell,
          taxRecipient: fallbackRecipient,
        };
        editBuyTax.value = String(fallbackBuy / 100);
        editSellTax.value = String(fallbackSell / 100);
        editTaxRecipient.value = fallbackRecipient;
      }
    } catch {
      // Non-blocking
    }
  }

  async function handleUpdateTax() {
    if (!account.value) return;
    updatingTax.value = true;
    try {
      const buyVal = parseFloat(editBuyTax.value || '0');
      const sellVal = parseFloat(editSellTax.value || '0');
      const recipient = (editTaxRecipient.value.trim() as `0x${string}`) || account.value;
      const hash = await setTokenTax(
        currentToken.value.address,
        buyVal,
        sellVal,
        recipient,
        tokenNetwork.value.chainId,
      );
      if (hash) {
        toast.success('Tax change proposed — activates in 24 hours', {
          description: `Buy Tax: ${buyVal}%, Sell Tax: ${sellVal}%`,
        });
        await loadOnchainTax(currentToken.value.address);
        await loadPendingTax(currentToken.value.address, tokenNetwork.value.chainId);
        taxModalOpen.value = false;
      }
    } catch (err) {
      toast.error('Failed to update tax: ' + (err as Error).message);
    } finally {
      updatingTax.value = false;
    }
  }

  return {
    editBuyTax,
    editSellTax,
    editTaxRecipient,
    handleAcceptTax,
    handleCancelTax,
    handleUpdateTax,
    hasPendingTax,
    loadOnchainTax,
    loadPendingTax,
    onchainTaxConfig,
    pendingTax,
    taxActionLoading,
    taxError,
    taxIsReady,
    taxModalOpen,
    taxSecondsUntilReady,
    updatingTax,
  };
}

export type UseTradeTax = ReturnType<typeof useTradeTax>;
