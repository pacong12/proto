import { ref, computed } from 'vue';
import { formatUnits } from 'viem';
import { protoFeeSplitterAbi, resolveFeeSplitter, type NetworkConfig } from '@proto/shared-types';
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
  /** Raw amount in the quote currency's smallest unit (wei for ETH, 6-dp units for USDC). */
  earnedWei: bigint;
  /** Human-readable earned amount, e.g. "0.0032" */
  earnedFormatted: string;
  splitterAddress: `0x${string}`;
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

/**
 * Reads per-token claimable dividends from each token's ProtoFeeSplitter (dividends stream in
 * over a day as fees are collected) and claims them with claim().
 *
 * Usage:
 *   const { entries, loadDividends, claimDividend } = useHolderDividends();
 *   await loadDividends(holderAddress, tokenList, network);
 */
export function useHolderDividends() {
  const entries = ref<HolderDividendEntry[]>([]);
  const loading = ref(false);
  const actionLoading = ref<string | null>(null); // token address being claimed
  const error = ref<string | null>(null);

  const totalEarnedWei = computed(() => entries.value.reduce((acc, e) => acc + e.earnedWei, 0n));

  const quoteDecimals = ref(18);

  const totalEarnedFormatted = computed(() => {
    const n = Number(formatUnits(totalEarnedWei.value, quoteDecimals.value));
    return isNaN(n) ? '0.0000' : n.toFixed(4);
  });

  async function readEntry(
    holderAddress: `0x${string}`,
    tok: { address: `0x${string}`; symbol: string; name: string },
    network: NetworkConfig,
  ): Promise<HolderDividendEntry | null> {
    const client = getPublicClient(network.chainId);
    const splitter = await resolveFeeSplitter(client, network, tok.address);
    if (!splitter) return null;
    quoteDecimals.value = splitter.quoteDecimals;
    const earned = await client.readContract({
      address: splitter.address,
      abi: protoFeeSplitterAbi,
      functionName: 'claimable',
      args: [holderAddress],
    });
    return {
      tokenAddress: tok.address,
      tokenSymbol: tok.symbol,
      tokenName: tok.name,
      earnedWei: earned,
      earnedFormatted: Number(formatUnits(earned, splitter.quoteDecimals)).toFixed(4),
      splitterAddress: splitter.address,
    };
  }

  const hasAnyEarned = computed(() => totalEarnedWei.value > 0n);

  /**
   * Query claimable() for every token in `tokens` in parallel.
   * Tokens without a splitter (not graduated yet / legacy) are skipped.
   */
  async function loadDividends(
    holderAddress: `0x${string}`,
    tokens: Array<{ address: `0x${string}`; symbol: string; name: string }>,
    network: NetworkConfig,
  ): Promise<void> {
    if (tokens.length === 0) {
      entries.value = [];
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const results = await Promise.allSettled(
        tokens.map((tok) => readEntry(holderAddress, tok, network)),
      );
      entries.value = results
        .map((r) => (r.status === 'fulfilled' ? r.value : null))
        .filter((e): e is HolderDividendEntry => e !== null && e.earnedWei > 0n);
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Query claimable() for a single token directly.
   */
  async function loadSingleTokenDividend(
    holderAddress: `0x${string}`,
    tokenAddress: `0x${string}`,
    tokenSymbol: string,
    tokenName: string,
    network: NetworkConfig,
  ): Promise<HolderDividendEntry | null> {
    if (!holderAddress) return null;
    try {
      return await readEntry(
        holderAddress,
        { address: tokenAddress, symbol: tokenSymbol, name: tokenName },
        network,
      );
    } catch {
      return null;
    }
  }

  /**
   * Call claim() on the token's splitter. Returns tx hash on success.
   */
  async function claimDividend(
    tokenAddress: `0x${string}`,
    network: NetworkConfig,
  ): Promise<`0x${string}` | null> {
    actionLoading.value = tokenAddress;
    error.value = null;

    try {
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error('No wallet connected');
      const [account] = await walletClient.getAddresses();
      if (!account) throw new Error('Please connect your wallet');

      const splitter = await resolveFeeSplitter(
        getPublicClient(network.chainId),
        network,
        tokenAddress,
      );
      if (!splitter) throw new Error('This token has no dividend splitter yet');

      const hash = await walletClient.writeContract({
        address: splitter.address,
        abi: protoFeeSplitterAbi,
        functionName: 'claim',
        args: [account],
        account,
        chain: walletClient.chain,
      });

      await getPublicClient(network.chainId).waitForTransactionReceipt({ hash });

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
  async function claimAllDividends(network: NetworkConfig): Promise<`0x${string}`[]> {
    const hashes: `0x${string}`[] = [];
    const pending = [...entries.value].filter((e) => e.earnedWei > 0n);
    for (const entry of pending) {
      const hash = await claimDividend(entry.tokenAddress, network);
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
    loadSingleTokenDividend,
    claimDividend,
    claimAllDividends,
    /** Reset entries to empty — call before loadDividends when switching wallet/profile. */
    reset() {
      entries.value = [];
    },
  };
}
