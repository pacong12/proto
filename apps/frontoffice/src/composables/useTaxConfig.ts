import { ref, computed } from 'vue';
import { launchpadTokenAbi } from '@goton/shared-types';
import { getPublicClient, getWalletClient } from '../lib/viem-client';

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
/**
 * FO-07: tax transactions must be sent on the token's chain; the wallet's current chain is not
 * necessarily the token's (Arc vs Robinhood), so refuse instead of broadcasting to the wrong one.
 */
async function assertWalletOnChain(
  walletClient: { getChainId(): Promise<number> },
  chainId?: number,
): Promise<void> {
  if (!chainId) return;
  const walletChainId = await walletClient.getChainId();
  if (walletChainId !== chainId) {
    throw new Error(`Switch your wallet to chain ${chainId} (the token's network) and retry.`);
  }
}

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

  async function proposeTaxConfig(
    tokenAddress: `0x${string}`,
    buyTaxBps: number,
    sellTaxBps: number,
    taxRecipient?: `0x${string}`,
    chainId?: number,
  ): Promise<`0x${string}` | null> {
    actionLoading.value = true;
    error.value = null;
    try {
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error('No wallet connected');
      const [account] = await walletClient.getAddresses();
      if (!account) throw new Error('Please connect your wallet');
      await assertWalletOnChain(walletClient, chainId);

      const recipient = taxRecipient || account;
      const hash = await walletClient.writeContract({
        address: tokenAddress,
        abi: launchpadTokenAbi,
        functionName: 'proposeTaxConfig',
        args: [buyTaxBps, sellTaxBps, recipient],
        account,
        chain: walletClient.chain,
      });

      const client = getPublicClient(chainId);
      await client.waitForTransactionReceipt({ hash });
      await loadPendingTax(tokenAddress, chainId);
      return hash;
    } catch (err) {
      error.value = (err as Error).message;
      return null;
    } finally {
      actionLoading.value = false;
    }
  }

  async function acceptTaxConfig(
    tokenAddress: `0x${string}`,
    chainId?: number,
  ): Promise<`0x${string}` | null> {
    actionLoading.value = true;
    error.value = null;
    try {
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error('No wallet connected');
      const [account] = await walletClient.getAddresses();
      if (!account) throw new Error('Please connect your wallet');
      await assertWalletOnChain(walletClient, chainId);

      const hash = await walletClient.writeContract({
        address: tokenAddress,
        abi: launchpadTokenAbi,
        functionName: 'acceptTaxConfig',
        args: [],
        account,
        chain: walletClient.chain,
      });

      const client = getPublicClient(chainId);
      await client.waitForTransactionReceipt({ hash });
      pending.value = null;
      return hash;
    } catch (err) {
      error.value = (err as Error).message;
      return null;
    } finally {
      actionLoading.value = false;
    }
  }

  async function cancelTaxConfig(
    tokenAddress: `0x${string}`,
    chainId?: number,
  ): Promise<`0x${string}` | null> {
    actionLoading.value = true;
    error.value = null;
    try {
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error('No wallet connected');
      const [account] = await walletClient.getAddresses();
      if (!account) throw new Error('Please connect your wallet');
      await assertWalletOnChain(walletClient, chainId);

      const hash = await walletClient.writeContract({
        address: tokenAddress,
        abi: launchpadTokenAbi,
        functionName: 'cancelTaxConfig',
        args: [],
        account,
        chain: walletClient.chain,
      });

      const client = getPublicClient(chainId);
      await client.waitForTransactionReceipt({ hash });
      pending.value = null;
      return hash;
    } catch (err) {
      error.value = (err as Error).message;
      return null;
    } finally {
      actionLoading.value = false;
    }
  }

  return {
    pending,
    loading,
    actionLoading,
    error,
    hasPending,
    isReady,
    secondsUntilReady,
    loadPendingTax,
    proposeTaxConfig,
    acceptTaxConfig,
    cancelTaxConfig,
  };
}
