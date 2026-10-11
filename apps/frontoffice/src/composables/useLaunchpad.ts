import { ref } from 'vue';
import { decodeEventLog, parseEventLogs, parseEther, type TransactionReceipt } from 'viem';
import { apiFetch } from '@/lib/api-client';

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

/**
 * Safely parse developer initial buy amount into 18-decimal wei.
 * Accepts string, number, null, or undefined and avoids calling parseEther on non-strings,
 * preventing 'value.split is not a function' TypeError.
 */
function parseInitialBuyWei(val: string | number | undefined | null): bigint {
  if (!val) return 0n;
  const str = String(val).trim();
  if (!str || str === '0' || isNaN(Number(str))) return 0n;
  const num = parseFloat(str);
  if (num <= 0) return 0n;
  try {
    return parseEther(str);
  } catch {
    const formatted = num.toFixed(18).replace(/\.?0+$/, '');
    return parseEther(formatted || '0');
  }
}
import {
  getNetworkConfig,
  launchpadV2FactoryAbi,
  robinhoodLaunchpadV2Abi,
  launchpadTokenAbi,
  bondingCurveAbi,
  liquidityLockerAbi,
  type LaunchedTokenEntity,
  type TokenMarketData,
  type TokenSocials,
} from '@proto/shared-types';
import { getPublicClient, getWalletClient } from '../lib/viem-client';
import { walletChainId } from '../lib/wallet-store';
import { getLiveEthPriceUsd } from '../lib/price-feed';

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
    curveAddress: `0x${string}`;
    poolAddress?: `0x${string}`;
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
      const targetFactory = network.contracts.factoryV2 ?? network.contracts.factory;
      if (!targetFactory || targetFactory === '0x0000000000000000000000000000000000000000') {
        throw new Error(`Factory contract not deployed on ${network.name}`);
      }

      // On all EVM chains (including Arc Network), native msg.value uses 18 decimals
      // (1e18 native wei = 1.0 token / 1.0 USDC) per Circle Arc EVM differences specification.
      const initialBuyWei = parseInitialBuyWei(params.initialBuyAmountEth);
      const totalValue = network.launchConfig.launchFeeWei + initialBuyWei;

      // Only old factory 0x4884... uses legacy 7-arg signature (selector 0x43a90f1e).
      // Canonical V2 factory (LaunchpadV2FactoryArc) uses 8 args including minInitialTokensOut (selector 0x0a16b906).
      const is7ArgFactory =
        targetFactory.toLowerCase() === '0x48844223abdceeb1ce502f54d559681358e68200';

      launchStep.value = 'awaiting_signature';

      let hash: `0x${string}`;
      if (targetFactory.toLowerCase() === '0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e') {
        // Robinhood Chain LaunchpadV2Factory (0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e)
        // Uses launchToken(params, initialBuyAmount, referral) with launchFee (0.0005 ETH)
        hash = await walletClient.writeContract({
          address: targetFactory,
          abi: robinhoodLaunchpadV2Abi,
          functionName: 'launchToken',
          args: [
            {
              name: params.name,
              symbol: params.symbol,
              logo: params.logo,
              description: params.description,
              socials: {
                twitter: params.socials.twitter ?? '',
                telegram: params.socials.telegram ?? '',
                discord: params.socials.discord ?? '',
                website: params.socials.website ?? '',
                farcaster: params.socials.farcaster ?? '',
              },
              creatorFeeRecipient: account,
              feeConfig: 0,
              isFair: false,
              b1: '0x0000000000000000000000000000000000000000000000000000000000000000',
              b2: '0x0000000000000000000000000000000000000000000000000000000000000000',
            },
            0n,
            '0x0000000000000000000000000000000000000000',
          ],
          value: network.launchConfig.launchFeeWei,
          account,
          chain: walletClient.chain,
        });
      } else if (is7ArgFactory) {
        hash = await walletClient.writeContract({
          address: targetFactory,
          abi: launchpadV2FactoryAbi,
          functionName: 'launchTokenV2',
          args: [
            params.name,
            params.symbol,
            params.logo,
            params.description,
            params.socials.twitter ?? '',
            params.socials.telegram ?? '',
            params.socials.website ?? '',
          ],
          value: totalValue,
          account,
          chain: walletClient.chain,
        });
      } else {
        hash = await walletClient.writeContract({
          address: targetFactory,
          abi: launchpadV2FactoryAbi,
          functionName: 'launchTokenV2',
          args: [
            params.name,
            params.symbol,
            params.logo,
            params.description,
            params.socials.twitter ?? '',
            params.socials.telegram ?? '',
            params.socials.website ?? '',
            params.minInitialTokensOut ?? 0n,
          ],
          value: totalValue,
          account,
          chain: walletClient.chain,
        });
      }

      launchTxHash.value = hash;
      launchStep.value = 'confirming';

      const publicClient = getPublicClient(network.chainId);
      let receipt;
      try {
        receipt = await publicClient.waitForTransactionReceipt({
          hash,
          timeout: 60_000,
          retryCount: 15,
          retryDelay: 1500,
        });
      } catch {
        try {
          receipt = await publicClient.getTransactionReceipt({ hash });
        } catch {
          // Still waiting
        }
        if (!receipt) {
          throw new Error(
            `Transaction broadcasted with hash ${hash}. Waiting for block confirmation is taking longer than expected. Check block explorer.`,
          );
        }
      }

      if (receipt.status === 'reverted') {
        throw new Error(
          `Transaction reverted on-chain (status: reverted). Hash: ${hash}. Block: ${receipt.blockNumber}. Check launch fee and gas.`,
        );
      }

      launchStep.value = 'indexing';

      // 1. Primary: decode via viem parseEventLogs (supports TokenLaunched and TokenLaunchedV2)
      const v2Events = parseEventLogs({
        abi: [...launchpadV2FactoryAbi, ...robinhoodLaunchpadV2Abi],
        logs: receipt.logs,
      });

      const launchEv = v2Events.find(
        (e) => e.eventName === 'TokenLaunched' || e.eventName === 'TokenLaunchedV2',
      );

      if (launchEv && 'token' in launchEv.args && 'curve' in launchEv.args) {
        const tokenAddr = launchEv.args.token as `0x${string}`;
        const curveAddr = launchEv.args.curve as `0x${string}`;
        launchStep.value = 'success';
        launchTokenAddress.value = tokenAddr;

        // Apply advanced trading tax configuration if specified
        if (
          (params.buyTaxPercent && params.buyTaxPercent > 0) ||
          (params.sellTaxPercent && params.sellTaxPercent > 0)
        ) {
          try {
            const buyTaxBps = Math.min(
              1000,
              Math.max(0, Math.round((params.buyTaxPercent || 0) * 100)),
            );
            const sellTaxBps = Math.min(
              1000,
              Math.max(0, Math.round((params.sellTaxPercent || 0) * 100)),
            );
            const recipient = (params.creatorTaxWallet as `0x${string}`) || account;
            const taxHash = await walletClient.writeContract({
              address: tokenAddr,
              abi: launchpadTokenAbi,
              functionName: 'proposeTaxConfig',
              args: [buyTaxBps, sellTaxBps, recipient],
              account,
              chain: walletClient.chain,
            });
            await publicClient.waitForTransactionReceipt({ hash: taxHash });
          } catch (taxErr) {
            console.warn('[LaunchpadV2] Post-launch proposeTaxConfig skipped or deferred:', taxErr);
          }
        }

        try {
          await apiFetch<unknown>(`/api/tokens/${tokenAddr}/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              txHash: hash,
              taxConfig: {
                buyTaxBps: Math.min(
                  1000,
                  Math.max(0, Math.round((params.buyTaxPercent || 0) * 100)),
                ),
                sellTaxBps: Math.min(
                  1000,
                  Math.max(0, Math.round((params.sellTaxPercent || 0) * 100)),
                ),
                taxRecipient: (params.creatorTaxWallet as `0x${string}`) || account,
                revenueSplit: params.revenueSplit,
              },
            }),
          });
        } catch {
          /* backend sync is best-effort */
        }

        return {
          tokenAddress: tokenAddr,
          curveAddress: curveAddr,
          poolAddress: curveAddr,
        };
      }

      // 2. Secondary fallback: check each log individually with decodeEventLog
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
            'token' in decoded.args &&
            'curve' in decoded.args
          ) {
            const tokenAddr = decoded.args.token as `0x${string}`;
            const curveAddr = decoded.args.curve as `0x${string}`;
            launchStep.value = 'success';
            launchTokenAddress.value = tokenAddr;
            return {
              tokenAddress: tokenAddr,
              curveAddress: curveAddr,
              poolAddress: curveAddr,
            };
          }
        } catch {
          // Continue searching logs
        }
      }

      console.error('[Launchpad] TokenLaunched not found in receipt. Logs:', receipt.logs);
      throw new Error(`TokenLaunched event not found in transaction receipt. Hash: ${hash}`);
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
  // Read: fetch token details from chain
  // ---------------------------------------------------------------------------

  async function fetchTokenDetails(tokenAddress: `0x${string}`) {
    try {
      const client = getPublicClient();
      const network = getNetworkConfig(walletChainId.value ?? undefined);
      const factoryAddress = network.contracts.factoryV2 ?? network.contracts.factory;

      const [name, symbol, logo, description, launchRecord, restrictionsEndBlock, launchBlock] =
        await Promise.all([
          client.readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'name',
          }),
          client.readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'symbol',
          }),
          client.readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'logo',
          }),
          client.readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'description',
          }),
          client
            .readContract({
              address: factoryAddress,
              abi: launchpadV2FactoryAbi,
              functionName: 'launches',
              args: [tokenAddress],
            })
            .catch(() => null),
          client
            .readContract({
              address: tokenAddress,
              abi: launchpadTokenAbi,
              functionName: 'restrictionsEndBlock',
            })
            .catch(() => 0n),
          client
            .readContract({
              address: tokenAddress,
              abi: launchpadTokenAbi,
              functionName: 'launchBlock',
            })
            .catch(() => 0n),
        ]);

      const curveAddress =
        launchRecord && launchRecord[1] !== '0x0000000000000000000000000000000000000000'
          ? (launchRecord[1] as `0x${string}`)
          : null;
      const deployer =
        launchRecord && launchRecord[2] !== '0x0000000000000000000000000000000000000000'
          ? (launchRecord[2] as `0x${string}`)
          : tokenAddress;

      let graduated = launchRecord ? Boolean(launchRecord[4]) : false;
      let totalRaisedWei = 0n;
      let targetWei = network.launchConfigV2?.graduationTargetWei ?? 4_200_000_000_000_000_000n;

      if (curveAddress) {
        try {
          const [raised, target, grad] = await Promise.all([
            client
              .readContract({
                address: curveAddress,
                abi: bondingCurveAbi,
                functionName: 'totalEthRaised',
              })
              .catch(() => 0n),
            client
              .readContract({
                address: curveAddress,
                abi: bondingCurveAbi,
                functionName: 'graduationTarget',
              })
              .catch(() => targetWei),
            client
              .readContract({
                address: curveAddress,
                abi: bondingCurveAbi,
                functionName: 'graduated',
              })
              .catch(() => graduated),
          ]);
          totalRaisedWei = raised;
          targetWei = target;
          graduated = grad;
        } catch {
          // ignore
        }
      }

      const progress =
        Number(targetWei) > 0 ? Math.min(1.0, Number(totalRaisedWei) / Number(targetWei)) : 0;

      const ethPriceUsd = await getLiveEthPriceUsd();
      const priceInWeth = 0.0000042;
      const priceUsd = priceInWeth * ethPriceUsd;
      const supplyTokens = 1_000_000_000;
      const marketCapUsd = priceUsd * supplyTokens;

      return {
        token: {
          address: tokenAddress,
          name,
          symbol,
          decimals: 18,
          totalSupply: (1_000_000_000n * 10n ** 18n).toString(),
          logo,
          description,
          socials: {},
          deployer,
          pairedToken: network.contracts.weth,
          poolAddress: curveAddress ?? tokenAddress,
          curveAddress: curveAddress ?? undefined,
          isToken0: false,
          poolFee: 10000,
          positionId: 0n,
          restrictionsEndBlock: restrictionsEndBlock as bigint,
          launchBlock: launchBlock as bigint,
          createdAt: Date.now(),
        },
        marketData: {
          address: tokenAddress,
          priceInWeth,
          priceUsd,
          marketCapUsd,
          fdvUsd: marketCapUsd,
          pairedPrincipalWeth: (Number(totalRaisedWei) / 1e18).toFixed(4),
          graduationThresholdWeth: (Number(targetWei) / 1e18).toFixed(1),
          graduationProgress: progress,
          isGraduated: graduated,
          volume24hUsd: 0,
        },
      };
    } catch (err) {
      error.value = (err as Error).message;
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Write: claim liquidity position fees
  // ---------------------------------------------------------------------------

  async function claimFees(tokenAddress: `0x${string}`): Promise<string | null> {
    loading.value = true;
    error.value = null;

    try {
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error('No Web3 wallet detected');

      const [account] = await walletClient.getAddresses();
      if (!account) throw new Error('Please connect your wallet');

      const network = getNetworkConfig(walletChainId.value ?? undefined);
      if (
        !network.contracts.locker ||
        network.contracts.locker === '0x0000000000000000000000000000000000000000'
      ) {
        throw new Error(`Liquidity locker not configured for ${network.name}`);
      }
      const hash = await walletClient.writeContract({
        address: network.contracts.locker,
        abi: liquidityLockerAbi,
        functionName: 'claimFees',
        args: [tokenAddress],
        account,
        chain: walletClient.chain,
      });
      await getPublicClient(network.chainId).waitForTransactionReceipt({ hash });
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
  // Write: redirect fee recipient for a deployed token
  // ---------------------------------------------------------------------------

  async function setFeeRedirect(
    tokenAddress: `0x${string}`,
    redirectAddress: `0x${string}`,
  ): Promise<string | null> {
    loading.value = true;
    error.value = null;

    try {
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error('No Web3 wallet detected');

      const [account] = await walletClient.getAddresses();
      if (!account) throw new Error('Please connect your wallet');

      const network = getNetworkConfig(walletChainId.value ?? undefined);
      if (
        !network.contracts.locker ||
        network.contracts.locker === '0x0000000000000000000000000000000000000000'
      ) {
        throw new Error(`Liquidity locker not configured for ${network.name}`);
      }
      const hash = await walletClient.writeContract({
        address: network.contracts.locker,
        abi: liquidityLockerAbi,
        functionName: 'setFeeRedirect',
        args: [tokenAddress, redirectAddress],
        account,
        chain: walletClient.chain,
      });
      await getPublicClient(network.chainId).waitForTransactionReceipt({ hash });
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
        abi: [...launchpadV2FactoryAbi, ...robinhoodLaunchpadV2Abi],
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
          abi: [...launchpadV2FactoryAbi, ...robinhoodLaunchpadV2Abi],
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

  async function setTokenTax(
    tokenAddress: `0x${string}`,
    buyTaxPercent: number,
    sellTaxPercent: number,
    taxRecipient?: `0x${string}`,
  ): Promise<`0x${string}` | null> {
    loading.value = true;
    error.value = null;
    try {
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error('No Web3 wallet detected');
      const [account] = await walletClient.getAddresses();
      if (!account) throw new Error('Please connect your wallet');

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

      const client = getPublicClient();
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
    fetchTokenDetails,
    claimFees,
    setFeeRedirect,
    setTokenTax,
    checkPendingTransaction,
  };
}
