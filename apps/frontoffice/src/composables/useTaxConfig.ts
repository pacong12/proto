import { ref, computed } from 'vue';
import { getNetworkConfig, launchpadTokenAbi } from '@goton/shared-types';
import { getPublicClient } from '../lib/viem-client';
import { runWalletAction, sendWalletTransaction } from '../lib/wallet-tx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingTaxConfig {
  buyTaxBps: number;
  sellTaxBps: number;
  taxRecipient: `0x${string}`;
  validAfter: bigint;
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

/**
 * Reads and manages the LaunchpadToken tax timelock state:
 * - pendingTaxConfig(): current queued proposal and when it activates
 * - acceptTaxConfig(): finalise after 24h timelock (deployer only)
 * - cancelTaxConfig(): abort a pending proposal (deployer only)
 *
 * This composable is intentionally stateless between mounts; the caller
 * refreshes by re-calling loadPendingTax().
 */
export function useTaxConfig() {
  const pending = ref<PendingTaxConfig | null>(null);
  const loading = ref(false);
  const actionLoading = ref(false);
  const error = ref<string | null>(null);

  const hasPending = computed(() => pending.value !== null && pending.value.validAfter > 0n);

  const isReady = computed(() => {
    if (!hasPending.value || !pending.value) return false;
    return BigInt(Math.floor(Date.now() / 1000)) >= pending.value.validAfter;
  });

  const secondsUntilReady = computed(() => {
    if (!hasPending.value || !pending.value) return 0;
    const now = BigInt(Math.floor(Date.now() / 1000));
    const diff = pending.value.validAfter - now;
    return diff > 0n ? Number(diff) : 0;
  });

  async function loadPendingTax(tokenAddress: `0x${string}`, chainId?: number): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const client = getPublicClient(chainId);
      const result = (await client.readContract({
        address: tokenAddress,
        abi: launchpadTokenAbi,
        functionName: 'pendingTaxConfig',
      })) as [number, number, `0x${string}`, bigint];

      // validAfter == 0 means no proposal is queued
      if (result[3] === 0n) {
        pending.value = null;
      } else {
        pending.value = {
          buyTaxBps: Number(result[0]),
          sellTaxBps: Number(result[1]),
          taxRecipient: result[2],
          validAfter: result[3],
        };
      }
    } catch {
      // Non-blocking: token may not implement pendingTaxConfig
      pending.value = null;
    } finally {
      loading.value = false;
    }
  }

  /** Sends a timelock action (accept or cancel) on the token's chain; the proposal then clears. */
  async function timelockAction(
    tokenAddress: `0x${string}`,
    functionName: 'acceptTaxConfig' | 'cancelTaxConfig',
    chainId: number,
  ): Promise<`0x${string}` | null> {
    const hash = await runWalletAction({ busy: actionLoading, error }, () =>
      sendWalletTransaction(getNetworkConfig(chainId), ({ walletClient, account }) =>
        walletClient.writeContract({
          address: tokenAddress,
          abi: launchpadTokenAbi,
          functionName,
          account,
          chain: walletClient.chain,
        }),
      ),
    );
    if (hash) pending.value = null;
    return hash;
  }

  /** Finalises the pending proposal after its 24h timelock (deployer only). */
  const acceptTaxConfig = (tokenAddress: `0x${string}`, chainId: number) =>
    timelockAction(tokenAddress, 'acceptTaxConfig', chainId);

  /** Aborts the pending proposal (deployer only). */
  const cancelTaxConfig = (tokenAddress: `0x${string}`, chainId: number) =>
    timelockAction(tokenAddress, 'cancelTaxConfig', chainId);

  return {
    pending,
    loading,
    actionLoading,
    error,
    hasPending,
    isReady,
    secondsUntilReady,
    loadPendingTax,
    acceptTaxConfig,
    cancelTaxConfig,
  };
}
