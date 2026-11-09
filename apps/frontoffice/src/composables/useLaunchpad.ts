import { ref } from 'vue';
import { decodeEventLog, parseEventLogs, type TransactionReceipt } from 'viem';
import { apiFetch } from '@/lib/api-client';
import { getLaunchModel, taxPercentToBps } from '@goton/math-sdk';

import {
  getNetworkConfig,
  launchpadV2FactoryAbi,
  launchpadTokenAbi,
  gotonFeeSplitterAbi,
  gotonV4GraduatorAbi,
  gotonV4HookAbi,
  feeCollector,
  protoV4PoolKeyFor,
  readCreatorFees,
  resolveFeeSplitter,
  v4PoolId,
  type LaunchedTokenEntity,
  type TokenMarketData,
} from '@goton/shared-types';
import { getPublicClient, getWalletClient } from '../lib/viem-client';
import {
  isUserRejection,
  requireConnectedWallet,
  runWalletAction,
  sendWalletTransaction,
} from '../lib/wallet-tx';
import { getChainAdapter, type ChainLaunchParams, type ChainLaunchResult } from '../chains';
import { walletChainId } from '../lib/wallet-store';
import { readSplitterRedirectState, type RedirectState } from '../lib/cto-redirect';

export type LaunchStep =
  | 'idle'
  | 'validating'
  | 'awaiting_signature'
  | 'broadcasting'
  | 'confirming'
  | 'indexing'
  | 'success'
  | 'error';

export function useLaunchpad() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const launchStep = ref<LaunchStep>('idle');
  const launchTxHash = ref<`0x${string}` | null>(null);
  const launchTokenAddress = ref<`0x${string}` | null>(null);
  const tokens = ref<Array<{ token: LaunchedTokenEntity; marketData: TokenMarketData }>>([]);

  function resetLaunchState() {
    launchStep.value = 'idle';
    launchTxHash.value = null;
    launchTokenAddress.value = null;
    error.value = null;
    loading.value = false;
  }

  // ---------------------------------------------------------------------------
  // V2: Launch via Bonding Curve (graduates to Uniswap V4)
  // Uses launchpadV2FactoryAbi from shared-types as the single source of truth (fix HIGH-03).
  // ---------------------------------------------------------------------------

  async function launchToken(
    params: ChainLaunchParams,
  ): Promise<(ChainLaunchResult & { taxApplied: boolean; splitApplied: boolean }) | null> {
    loading.value = true;
    error.value = null;
    launchStep.value = 'validating';
    launchTxHash.value = null;
    launchTokenAddress.value = null;

    try {
      const { walletClient, account } = await requireConnectedWallet();

      let activeChainId = walletChainId.value ?? undefined;
      try {
        const clientChainId = await walletClient.getChainId();
        if (clientChainId) {
          activeChainId = clientChainId;
          walletChainId.value = clientChainId;
        }
      } catch {
        // Fall back to walletChainId.value
      }

      const network = getNetworkConfig(activeChainId);
      // Chain-specific launch logic (factory ABI, prebuy rules, tax handling) lives in the
      // chain adapter, so adding a chain does not touch this composable.
      const adapter = getChainAdapter(network.chainId);
      const publicClient = getPublicClient(network.chainId);

      launchStep.value = 'awaiting_signature';
      const result = await adapter.launchToken(
        params,
        walletClient,
        publicClient,
        account,
        (hash) => {
          launchTxHash.value = hash;
          launchStep.value = 'confirming';
        },
      );
      if (!result) {
        throw new Error(
          `Launch event not found in the transaction receipt. Hash: ${launchTxHash.value ?? 'unknown'}`,
        );
      }

      launchStep.value = 'indexing';
      launchTokenAddress.value = result.tokenAddress;

      // FO-05: only report a tax configuration to the API when it is live on-chain.
      try {
        await apiFetch<unknown>(`/api/tokens/${result.tokenAddress}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txHash: launchTxHash.value,
            chain: network.chainId,
            ...(result.taxApplied
              ? {
                  taxConfig: {
                    buyTaxBps: taxPercentToBps(params.buyTaxPercent || 0),
                    sellTaxBps: taxPercentToBps(params.sellTaxPercent || 0),
                    taxRecipient: params.creatorTaxWallet || account,
                    revenueSplit: params.revenueSplit,
                  },
                }
              : {}),
          }),
        });
      } catch {
        /* backend sync is best-effort */
      }

      launchStep.value = 'success';
      return {
        tokenAddress: result.tokenAddress,
        curveAddress: result.curveAddress,
        poolAddress: result.poolAddress,
        taxApplied: result.taxApplied ?? true,
        splitApplied: result.splitApplied ?? true,
      };
    } catch (err) {
      if (isUserRejection(err)) {
        launchStep.value = 'idle';
        error.value = null;
      } else {
        launchStep.value = 'error';
        error.value = (err as Error).message;
      }
      return null;
    } finally {
      loading.value = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Write: claim creator fees from the token's GotonFeeSplitter
  // ---------------------------------------------------------------------------

  /** The token's creator fee splitter on `chainId` (default: the wallet's network). */
  async function creatorSplitter(tokenAddress: `0x${string}`, chainId?: number) {
    const network = getNetworkConfig(chainId ?? walletChainId.value ?? undefined);
    const publicClient = getPublicClient(network.chainId);
    const splitter = await resolveFeeSplitter(publicClient, network, tokenAddress);
    if (!splitter) throw new Error(`No fee splitter for this token on ${network.name} yet`);
    return { network, publicClient, splitter: splitter.address };
  }

  const actionState = { busy: loading, error };

  /**
   * Claims the creator's fees, collecting the pool's uncollected LP fees and the hook's held tax
   * into the splitter first (both permissionless): the figure shown includes them, and until the
   * keeper collects them claimCreatorFees alone would pay none of it.
   */
  function claimFees(tokenAddress: `0x${string}`, chainId?: number): Promise<string | null> {
    return runWalletAction(actionState, async () => {
      const { network, publicClient, splitter } = await creatorSplitter(tokenAddress, chainId);
      const fees = await readCreatorFees(publicClient, network, tokenAddress);
      const collector = feeCollector(network);
      const key = protoV4PoolKeyFor(network, tokenAddress);
      if (fees && fees.uncollectedTax > 0n && key) {
        await sendWalletTransaction(network, ({ walletClient, account }) =>
          walletClient.writeContract({
            address: key.hooks,
            abi: gotonV4HookAbi,
            functionName: 'flushTaxes',
            args: [v4PoolId(key)],
            account,
            chain: walletClient.chain,
          }),
        );
      }
      if (fees && fees.uncollectedLpFees > 0n && collector) {
        await sendWalletTransaction(network, ({ walletClient, account }) =>
          walletClient.writeContract({
            address: collector.address,
            abi: collector.abi as typeof gotonV4GraduatorAbi,
            functionName: 'collectFees',
            args: [tokenAddress],
            account,
            chain: walletClient.chain,
          }),
        );
      }
      return sendWalletTransaction(network, ({ walletClient, account }) =>
        walletClient.writeContract({
          address: splitter,
          abi: gotonFeeSplitterAbi,
          functionName: 'claimCreatorFees',
          account,
          chain: walletClient.chain,
        }),
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Community takeover: the creator redirects their own fee share (48h timelock, optional lock)
  // ---------------------------------------------------------------------------

  /** Current recipient, pending proposal and lock of the token's splitter. */
  async function readRedirectState(
    tokenAddress: `0x${string}`,
    chainId?: number,
  ): Promise<RedirectState> {
    const { publicClient, splitter } = await creatorSplitter(tokenAddress, chainId);
    return readSplitterRedirectState(publicClient, splitter);
  }

  function writeRedirect(
    tokenAddress: `0x${string}`,
    chainId: number | undefined,
    call:
      | { functionName: 'proposeCreatorRecipient'; args: readonly [`0x${string}`] }
      | {
          functionName:
            'acceptCreatorRecipient' | 'cancelCreatorRecipient' | 'lockCreatorRecipient';
        },
  ): Promise<`0x${string}` | null> {
    return runWalletAction(actionState, async () => {
      const { network, splitter } = await creatorSplitter(tokenAddress, chainId);
      return sendWalletTransaction(network, ({ walletClient, account }) =>
        walletClient.writeContract({
          address: splitter,
          abi: gotonFeeSplitterAbi,
          ...call,
          account,
          chain: walletClient.chain,
        }),
      );
    });
  }

  /** Creator only: proposes `recipient`; it can be accepted after the 48h timelock. */
  function proposeCreatorRecipient(
    tokenAddress: `0x${string}`,
    recipient: `0x${string}`,
    chainId?: number,
  ): Promise<`0x${string}` | null> {
    return writeRedirect(tokenAddress, chainId, {
      functionName: 'proposeCreatorRecipient',
      args: [recipient],
    });
  }

  /** Creator or the pending recipient: activates the proposal once its timelock has passed. */
  function acceptCreatorRecipient(
    tokenAddress: `0x${string}`,
    chainId?: number,
  ): Promise<`0x${string}` | null> {
    return writeRedirect(tokenAddress, chainId, { functionName: 'acceptCreatorRecipient' });
  }

  /** Creator only: drops the pending proposal. */
  function cancelCreatorRecipient(
    tokenAddress: `0x${string}`,
    chainId?: number,
  ): Promise<`0x${string}` | null> {
    return writeRedirect(tokenAddress, chainId, { functionName: 'cancelCreatorRecipient' });
  }

  /** Creator only, irreversible: fixes the current recipient forever (v2 splitters). */
  function lockCreatorRecipient(
    tokenAddress: `0x${string}`,
    chainId?: number,
  ): Promise<`0x${string}` | null> {
    return writeRedirect(tokenAddress, chainId, { functionName: 'lockCreatorRecipient' });
  }

  /** @deprecated Use {@link proposeCreatorRecipient}; kept for the create-token flow. */
  function setFeeRedirect(
    tokenAddress: `0x${string}`,
    redirectAddress: `0x${string}`,
  ): Promise<string | null> {
    return proposeCreatorRecipient(tokenAddress, redirectAddress);
  }

  function extractLaunchData(receipt: TransactionReceipt): {
    tokenAddress: `0x${string}`;
    poolAddress?: `0x${string}`;
    curveAddress?: `0x${string}`;
  } | null {
    try {
      const v2Events = parseEventLogs({
        abi: launchpadV2FactoryAbi,
        logs: receipt.logs,
      });
      const launchEv = v2Events.find(
        (e) => e.eventName === 'TokenLaunched' || e.eventName === 'TokenLaunchedV2',
      );
      if (launchEv && 'token' in launchEv.args) {
        const tokenAddr = launchEv.args.token as `0x${string}`;
        const curveAddr = (launchEv.args as { curve?: `0x${string}` }).curve ?? tokenAddr;
        return {
          tokenAddress: tokenAddr,
          curveAddress: curveAddr,
          poolAddress: curveAddr,
        };
      }
    } catch {
      // fallback
    }

    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: launchpadV2FactoryAbi,
          topics: log.topics,
          data: log.data,
        });
        if (
          decoded &&
          (decoded.eventName === 'TokenLaunched' || decoded.eventName === 'TokenLaunchedV2') &&
          decoded.args &&
          'token' in decoded.args
        ) {
          const tokenAddr = decoded.args.token as `0x${string}`;
          const curveAddr = (decoded.args as { curve?: `0x${string}` }).curve ?? tokenAddr;
          return {
            tokenAddress: tokenAddr,
            curveAddress: curveAddr,
            poolAddress: curveAddr,
          };
        }
      } catch {
        // continue
      }
    }
    return null;
  }

  async function checkPendingTransaction(
    hashOverride?: `0x${string}`,
  ): Promise<{ tokenAddress: `0x${string}`; poolAddress?: `0x${string}` } | null> {
    const hash = hashOverride ?? launchTxHash.value;
    if (!hash) return null;

    try {
      let activeChainId = walletChainId.value ?? undefined;
      try {
        const walletClient = await getWalletClient();
        if (walletClient) {
          const clientChainId = await walletClient.getChainId();
          if (clientChainId) activeChainId = clientChainId;
        }
      } catch {
        // Fall back
      }
      const network = getNetworkConfig(activeChainId);
      const publicClient = getPublicClient(network.chainId);
      const receipt = await publicClient.getTransactionReceipt({ hash }).catch(() => null);
      if (!receipt) return null;

      if (receipt.status === 'reverted') {
        launchStep.value = 'error';
        error.value = `Transaction reverted on-chain (status: reverted). Hash: ${hash}. Block: ${receipt.blockNumber}.`;
        return null;
      }

      launchStep.value = 'indexing';

      const launchData = extractLaunchData(receipt);
      if (launchData) {
        // Index it now, as the normal path does: without this the coin page opened before the
        // indexer had seen the launch and said "Token not found".
        await apiFetch<unknown>(`/api/tokens/${launchData.tokenAddress}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txHash: hash, chain: network.chainId }),
        }).catch(() => {
          /* best-effort, as in launch() */
        });
        launchStep.value = 'success';
        launchTokenAddress.value = launchData.tokenAddress;
        error.value = null;
        return {
          tokenAddress: launchData.tokenAddress,
          poolAddress: launchData.curveAddress ?? launchData.poolAddress,
        };
      }
    } catch (err) {
      console.warn('[checkPendingTransaction] Error querying receipt:', err);
    }
    return null;
  }

  /**
   * Retries a revenue split that did not land at launch (Robinhood Chain). Works only until the
   * first third-party buy; after that the default split is final.
   */
  async function retryRevenueSplit(
    tokenAddress: `0x${string}`,
    revenueSplit: { creator: number; buyback: number; holders: number; growth: number },
    chainId: number,
  ): Promise<boolean> {
    const applied = await runWalletAction(actionState, async () => {
      const network = getNetworkConfig(chainId);
      const { walletClient, account } = await requireConnectedWallet(network);
      const adapter = getChainAdapter(network.chainId);
      if (!adapter.applyRevenueSplit) return true;
      return adapter.applyRevenueSplit(
        tokenAddress,
        revenueSplit,
        walletClient,
        getPublicClient(network.chainId),
        account,
      );
    });
    return applied ?? false;
  }

  function setTokenTax(
    tokenAddress: `0x${string}`,
    buyTaxPercent: number,
    sellTaxPercent: number,
    taxRecipient?: `0x${string}`,
    chainId?: number,
  ): Promise<`0x${string}` | null> {
    return runWalletAction(actionState, () => {
      const network = getNetworkConfig(chainId ?? walletChainId.value ?? undefined);
      if (getLaunchModel(network.chainId) === 'v4-in-pool') {
        throw new Error(
          `Taxes on ${network.name} are fixed forever at launch and cannot be changed.`,
        );
      }
      return sendWalletTransaction(network, ({ walletClient, account }) =>
        walletClient.writeContract({
          address: tokenAddress,
          abi: launchpadTokenAbi,
          functionName: 'proposeTaxConfig',
          args: [
            taxPercentToBps(buyTaxPercent),
            taxPercentToBps(sellTaxPercent),
            taxRecipient || account,
          ],
          account,
          chain: walletClient.chain,
        }),
      );
    });
  }

  return {
    loading,
    error,
    launchStep,
    launchTxHash,
    launchTokenAddress,
    resetLaunchState,
    tokens,
    launchToken,
    claimFees,
    setFeeRedirect,
    readRedirectState,
    proposeCreatorRecipient,
    acceptCreatorRecipient,
    cancelCreatorRecipient,
    lockCreatorRecipient,
    setTokenTax,
    retryRevenueSplit,
    checkPendingTransaction,
  };
}
