import { ref, computed } from 'vue';
import { formatEther } from 'viem';
import { holderFeeDistributorAbi } from '@proto/shared-types';
import { getPublicClient, getWalletClient } from '../lib/viem-client';

function isUserRejection(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const msg = 'message' in err && typeof err.message === 'string' ? err.message.toLowerCase() : '';
  const code = 'code' in err && typeof err.code === 'number' ? err.code : null;
  return (
    msg.includes('user rejected') ||
    msg.includes('user denied') ||
    msg.includes('rejected') ||
    code === 4001
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HolderDividendEntry {
  tokenAddress: `0x${string}`;
  tokenSymbol: string;
  tokenName: string;
  earnedWei: bigint;
  /** Human-readable earned amount, e.g. "0.0032" */
  earnedFormatted: string;
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

/**
 * Reads per-token earned WETH from HolderFeeDistributor for a given holder
 * and allows claiming with claimReward().
 *
 * Usage:
 *   const { entries, totalEarnedWei, loadDividends, claimDividend, loading, actionLoading, error } = useHolderDividends();
 *   await loadDividends(holderAddress, tokenList, chainId);
 */
export function useHolderDividends() {
  const entries = ref<HolderDividendEntry[]>([]);
  const loading = ref(false);
  const actionLoading = ref<string | null>(null); // token address being claimed
  const error = ref<string | null>(null);

  const totalEarnedWei = computed(() => entries.value.reduce((acc, e) => acc + e.earnedWei, 0n));

  const totalEarnedFormatted = computed(() => {
    const n = Number(formatEther(totalEarnedWei.value));
    return n.toFixed(4);
  });

  const hasAnyEarned = computed(() => totalEarnedWei.value > 0n);

  /**
   * Query earned() for every token in `tokenAddresses` in parallel.
   * Tokens whose distributor reverts (e.g. token without holder sharing) are silently skipped.
   */
  async function loadDividends(
    holderAddress: `0x${string}`,
    tokens: Array<{ address: `0x${string}`; symbol: string; name: string }>,
    distributorAddress: `0x${string}`,
    chainId?: number,
  ): Promise<void> {
    const zero = '0x0000000000000000000000000000000000000000';
    if (!distributorAddress || distributorAddress === zero || tokens.length === 0) {
      entries.value = [];
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const client = getPublicClient(chainId);

      const results = await Promise.allSettled(
        tokens.map(async (tok) => {
          const earned = (await client.readContract({
            address: distributorAddress,
            abi: holderFeeDistributorAbi,
            functionName: 'earned',
            args: [tok.address, holderAddress],
          })) as bigint;

          return {
            tokenAddress: tok.address,
            tokenSymbol: tok.symbol,
            tokenName: tok.name,
            earnedWei: earned,
            earnedFormatted: Number(formatEther(earned)).toFixed(4),
          };
        }),
      );

      entries.value = results
        .filter(
          (r): r is PromiseFulfilledResult<HolderDividendEntry> =>
            r.status === 'fulfilled' && r.value.earnedWei > 0n,
        )
        .map((r) => r.value);
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Call claimReward(token) on the distributor. Returns tx hash on success.
   */
  async function claimDividend(
    tokenAddress: `0x${string}`,
    distributorAddress: `0x${string}`,
    chainId?: number,
  ): Promise<`0x${string}` | null> {
    actionLoading.value = tokenAddress;
    error.value = null;

    try {
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error('No wallet connected');
      const [account] = await walletClient.getAddresses();
      if (!account) throw new Error('Please connect your wallet');

      const hash = await walletClient.writeContract({
        address: distributorAddress,
        abi: holderFeeDistributorAbi,
        functionName: 'claimReward',
        args: [tokenAddress],
        account,
        chain: walletClient.chain,
      });

      await getPublicClient(chainId).waitForTransactionReceipt({ hash });

      // Remove claimed entry from list
      entries.value = entries.value.filter((e) => e.tokenAddress !== tokenAddress);

      return hash;
    } catch (err) {
      if (!isUserRejection(err)) {
        error.value = (err as Error).message;
      }
      return null;
    } finally {
      actionLoading.value = null;
    }
  }

  /**
   * Claim all tokens with earned > 0 sequentially to avoid nonce collisions.
   */
  async function claimAllDividends(
    distributorAddress: `0x${string}`,
    chainId?: number,
  ): Promise<`0x${string}`[]> {
    const hashes: `0x${string}`[] = [];
    const pending = [...entries.value].filter((e) => e.earnedWei > 0n);
    for (const entry of pending) {
      const hash = await claimDividend(entry.tokenAddress, distributorAddress, chainId);
      if (hash) hashes.push(hash);
    }
    return hashes;
  }

  return {
    entries,
    loading,
    actionLoading,
    error,
    totalEarnedWei,
    totalEarnedFormatted,
    hasAnyEarned,
    loadDividends,
    claimDividend,
    claimAllDividends,
    /** Reset entries to empty — call before loadDividends when switching wallet/profile. */
    reset() {
      entries.value = [];
    },
  };
}
