import { ref, computed } from 'vue';
import { gotonFeeSplitterAbi, resolveFeeSplitter, type NetworkConfig } from '@goton/shared-types';
import { formatDividendAmount } from '../lib/currency-totals';
import { getPublicClient } from '../lib/viem-client';
import { isUserRejection, sendWalletTransaction } from '../lib/wallet-tx';

export { formatDividendAmount };

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
  /** The chain of the token: what a claim runs on, and what the amount is paid in. */
  network: NetworkConfig;
  currencySymbol: string;
  quoteDecimals: number;
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

/**
 * Reads per-token claimable dividends from each token's GotonFeeSplitter (dividends stream in
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
  // The newest load: an older one that settles later (another profile's wallet, opened before
  // this one) must not replace its entries.
  let loadSeq = 0;

  async function readEntry(
    holderAddress: `0x${string}`,
    tok: { address: `0x${string}`; symbol: string; name: string },
    network: NetworkConfig,
  ): Promise<HolderDividendEntry | null> {
    const client = getPublicClient(network.chainId);
    const splitter = await resolveFeeSplitter(client, network, tok.address);
    if (!splitter) return null;
    const earned = await client.readContract({
      address: splitter.address,
      abi: gotonFeeSplitterAbi,
      functionName: 'claimable',
      args: [holderAddress],
    });
    return {
      tokenAddress: tok.address,
      tokenSymbol: tok.symbol,
      tokenName: tok.name,
      earnedWei: earned,
      earnedFormatted: formatDividendAmount(earned, splitter.quoteDecimals),
      splitterAddress: splitter.address,
      network,
      currencySymbol: network.nativeCurrency.symbol,
      quoteDecimals: splitter.quoteDecimals,
    };
  }

  const hasAnyEarned = computed(() => entries.value.some((e) => e.earnedWei > 0n));

  /**
   * Query claimable() for every token in `tokens` in parallel.
   * Tokens without a splitter (not graduated yet / legacy) are skipped.
   * `networkOf` gives each token's own chain: a wallet can hold tokens on several.
   */
  async function loadDividends(
    holderAddress: `0x${string}`,
    tokens: Array<{ address: `0x${string}`; symbol: string; name: string }>,
    networkOf: (address: `0x${string}`) => NetworkConfig,
  ): Promise<void> {
    const seq = ++loadSeq;
    if (tokens.length === 0) {
      entries.value = [];
      loading.value = false;
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const results = await Promise.allSettled(
        tokens.map((tok) => readEntry(holderAddress, tok, networkOf(tok.address))),
      );
      if (seq !== loadSeq) return;
      entries.value = results
        .map((r) => (r.status === 'fulfilled' ? r.value : null))
        .filter((e): e is HolderDividendEntry => e !== null && e.earnedWei > 0n);
    } catch (err) {
      if (seq === loadSeq) error.value = (err as Error).message;
    } finally {
      if (seq === loadSeq) loading.value = false;
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
      const splitter = await resolveFeeSplitter(
        getPublicClient(network.chainId),
        network,
        tokenAddress,
      );
      if (!splitter) throw new Error('This token has no dividend splitter yet');

      const hash = await sendWalletTransaction(network, ({ walletClient, account }) =>
        walletClient.writeContract({
          address: splitter.address,
          abi: gotonFeeSplitterAbi,
          functionName: 'claim',
          args: [account],
          account,
          chain: walletClient.chain,
        }),
      );

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
   * Claim all tokens with earned > 0 sequentially to avoid nonce collisions, each on its own chain.
   */
  async function claimAllDividends(): Promise<`0x${string}`[]> {
    const hashes: `0x${string}`[] = [];
    const pending = [...entries.value].filter((e) => e.earnedWei > 0n);
    for (const entry of pending) {
      const hash = await claimDividend(entry.tokenAddress, entry.network);
      if (hash) hashes.push(hash);
    }
    return hashes;
  }

  return {
    entries,
    loading,
    actionLoading,
    error,
    hasAnyEarned,
    loadDividends,
    loadSingleTokenDividend,
    claimDividend,
    claimAllDividends,
    /** Reset entries to empty — call before loadDividends when switching wallet/profile. */
    reset() {
      loadSeq++;
      entries.value = [];
      loading.value = false;
    },
  };
}
