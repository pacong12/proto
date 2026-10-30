import { ref } from 'vue';
import { decodeEventLog, parseEventLogs, type TransactionReceipt } from 'viem';
import { apiFetch } from '@/lib/api-client';
import { getChainMathConfig, taxPercentToBps } from '@goton/math-sdk';

/**
 * Return true when the error originates from the user explicitly rejecting
 * the transaction in their wallet (EIP-1193 code 4001 or equivalent messages
 * from MetaMask, WalletConnect, OKX, Bitget, Coinbase Wallet).
 */
function isUserRejection(err: unknown): boolean {
  const msg = ((err as Error)?.message ?? '').toLowerCase();
  const code = (err as { code?: number })?.code;
  return (
    code === 4001 ||
    msg.includes('user reject') ||
    msg.includes('user denied') ||
    msg.includes('user cancelled') ||
    msg.includes('user canceled') ||
    msg.includes('action_rejected') ||
    msg.includes('rejected the request') ||
    msg.includes('rejected by user') ||
    msg.includes('transaction was rejected') ||
    msg.includes('request rejected')
  );
}

import {
  getNetworkConfig,
  launchpadV2FactoryAbi,
  launchpadTokenAbi,
  gotonFeeSplitterAbi,
  resolveFeeSplitter,
  type LaunchedTokenEntity,
  type TokenMarketData,
  type TokenSocials,
} from '@goton/shared-types';
import { getPublicClient, getWalletClient } from '../lib/viem-client';
import { getChainAdapter } from '../chains';
import { walletChainId } from '../lib/wallet-store';

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

  async function launchToken(params: {
    name: string;
    symbol: string;
    logo: string;
    description: string;
    socials: TokenSocials;
    initialBuyAmountEth?: string;
    minInitialTokensOut?: bigint;
    buyTaxPercent?: number;
    sellTaxPercent?: number;
    creatorTaxWallet?: string;
    revenueSplit?: {
      creator: number;
      buyback: number;
      holders: number;
      growth: number;
    };
  }): Promise<{
    tokenAddress: `0x${string}`;
    curveAddress?: `0x${string}`;
    poolAddress?: `0x${string}`;
    /** False when the creator tax or revenue split did not land on-chain. */
    taxApplied: boolean;
    splitApplied: boolean;
  } | null> {
    loading.value = true;
    error.value = null;
    launchStep.value = 'validating';
    launchTxHash.value = null;
    launchTokenAddress.value = null;

    try {
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error('No Web3 wallet detected');

      const [account] = await walletClient.getAddresses();
      if (!account) throw new Error('Please connect your wallet');

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
        {
          name: params.name,
          symbol: params.symbol,
          logo: params.logo,
          description: params.description,
          socials: params.socials,
          initialBuyAmountEth: params.initialBuyAmountEth,
          minInitialTokensOut: params.minInitialTokensOut,
          buyTaxPercent: params.buyTaxPercent,
          sellTaxPercent: params.sellTaxPercent,
          creatorTaxWallet: (params.creatorTaxWallet as `0x${string}` | undefined) || undefined,
          revenueSplit: params.revenueSplit,
        },
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
                    taxRecipient: (params.creatorTaxWallet as `0x${string}`) || account,
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

  async function resolveCreatorSplitter(tokenAddress: `0x${string}`) {
    const walletClient = await getWalletClient();
    if (!walletClient) throw new Error('No Web3 wallet detected');
    const [account] = await walletClient.getAddresses();
    if (!account) throw new Error('Please connect your wallet');
    const network = getNetworkConfig(walletChainId.value ?? undefined);
    const publicClient = getPublicClient(network.chainId);
    const splitter = await resolveFeeSplitter(publicClient, network, tokenAddress);
    if (!splitter) throw new Error(`No fee splitter for this token on ${network.name} yet`);
    return { walletClient, account, publicClient, splitter: splitter.address };
  }

  async function claimFees(tokenAddress: `0x${string}`): Promise<string | null> {
    loading.value = true;
    error.value = null;

    try {
      const { walletClient, account, publicClient, splitter } =
        await resolveCreatorSplitter(tokenAddress);
      const hash = await walletClient.writeContract({
        address: splitter,
        abi: gotonFeeSplitterAbi,
        functionName: 'claimCreatorFees',
        account,
        chain: walletClient.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      return hash;
    } catch (err) {
      if (!isUserRejection(err)) {
        error.value = (err as Error).message;
      }
      return null;
    } finally {
      loading.value = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Write: redirect creator fees (community takeover) — 48h propose / accept
  // ---------------------------------------------------------------------------

  /**
   * First call proposes `redirectAddress`; calling again with the same address once the 48h
   * timelock has passed accepts it (FO-04: the redirect previously never became active).
   */
  async function setFeeRedirect(
    tokenAddress: `0x${string}`,
    redirectAddress: `0x${string}`,
  ): Promise<string | null> {
    loading.value = true;
    error.value = null;

    try {
      const { walletClient, account, publicClient, splitter } =
        await resolveCreatorSplitter(tokenAddress);
      const [pending, validAfter] = await Promise.all([
        publicClient.readContract({
          address: splitter,
          abi: gotonFeeSplitterAbi,
          functionName: 'pendingCreatorRecipient',
        }),
        publicClient.readContract({
          address: splitter,
          abi: gotonFeeSplitterAbi,
          functionName: 'pendingCreatorRecipientValidAfter',
        }),
      ]);
      const now = BigInt(Math.floor(Date.now() / 1000));
      const accept = pending.toLowerCase() === redirectAddress.toLowerCase();
      if (accept && now < validAfter) {
        const hours = Math.ceil(Number(validAfter - now) / 3600);
        throw new Error(`Redirect already proposed; it can be accepted in about ${hours}h.`);
      }

      const hash = accept
        ? await walletClient.writeContract({
            address: splitter,
            abi: gotonFeeSplitterAbi,
            functionName: 'acceptCreatorRecipient',
            account,
            chain: walletClient.chain,
          })
        : await walletClient.writeContract({
            address: splitter,
            abi: gotonFeeSplitterAbi,
            functionName: 'proposeCreatorRecipient',
            args: [redirectAddress],
            account,
            chain: walletClient.chain,
          });
      await publicClient.waitForTransactionReceipt({ hash });
      return hash;
    } catch (err) {
      if (!isUserRejection(err)) {
        error.value = (err as Error).message;
      }
      return null;
    } finally {
      loading.value = false;
    }
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
    loading.value = true;
    error.value = null;
    try {
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error('No Web3 wallet detected');
      const [account] = await walletClient.getAddresses();
      if (!account) throw new Error('Please connect your wallet');
      const network = getNetworkConfig(chainId);
      if ((await walletClient.getChainId()) !== network.chainId) {
        throw new Error(`Switch your wallet to ${network.name} and retry.`);
      }
      const adapter = getChainAdapter(network.chainId);
      if (!adapter.applyRevenueSplit) return true;
      return await adapter.applyRevenueSplit(
        tokenAddress,
        revenueSplit,
        walletClient,
        getPublicClient(network.chainId),
        account,
      );
    } catch (err) {
      if (!isUserRejection(err)) error.value = (err as Error).message;
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function setTokenTax(
    tokenAddress: `0x${string}`,
    buyTaxPercent: number,
    sellTaxPercent: number,
    taxRecipient?: `0x${string}`,
    chainId?: number,
  ): Promise<`0x${string}` | null> {
    loading.value = true;
    error.value = null;
    try {
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error('No Web3 wallet detected');
      const [account] = await walletClient.getAddresses();
      if (!account) throw new Error('Please connect your wallet');

      const network = getNetworkConfig(chainId ?? walletChainId.value ?? undefined);
      if (getChainMathConfig(network.chainId)?.model === 'v4-in-pool') {
        throw new Error(
          `Taxes on ${network.name} are fixed forever at launch and cannot be changed.`,
        );
      }
      // FO-07: send and confirm on the token's chain, never on whatever chain the wallet is on.
      if ((await walletClient.getChainId()) !== network.chainId) {
        throw new Error(`Switch your wallet to ${network.name} and retry.`);
      }

      const buyTaxBps = Math.min(1000, Math.max(0, Math.round(buyTaxPercent * 100)));
      const sellTaxBps = Math.min(1000, Math.max(0, Math.round(sellTaxPercent * 100)));
      const recipient = taxRecipient || account;

      const hash = await walletClient.writeContract({
        address: tokenAddress,
        abi: launchpadTokenAbi,
        functionName: 'proposeTaxConfig',
        args: [buyTaxBps, sellTaxBps, recipient],
        account,
        chain: walletClient.chain,
      });

      const client = getPublicClient(network.chainId);
      await client.waitForTransactionReceipt({ hash });
      return hash;
    } catch (err) {
      if (!isUserRejection(err)) {
        error.value = (err as Error).message;
      }
      return null;
    } finally {
      loading.value = false;
    }
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
    setTokenTax,
    retryRevenueSplit,
    checkPendingTransaction,
  };
}
