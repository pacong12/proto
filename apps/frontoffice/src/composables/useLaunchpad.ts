import { ref } from 'vue';
import { decodeEventLog, parseEventLogs, parseEther } from 'viem';
import {
  ROBINHOOD_CHAIN,
  getNetworkConfig,
  launchpadFactoryAbi,
  launchpadV2FactoryAbi,
  launchpadTokenAbi,
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
  // V1: Launch via Uniswap V3 direct pool
  // ---------------------------------------------------------------------------

  async function launchTokenV1(params: {
    name: string;
    symbol: string;
    logo: string;
    description: string;
    socials: TokenSocials;
    initialBuyAmountEth?: string;
  }): Promise<{ tokenAddress: `0x${string}`; poolAddress: `0x${string}` } | null> {
    loading.value = true;
    error.value = null;
    launchStep.value = 'validating';
    launchTxHash.value = null;
    launchTokenAddress.value = null;

    try {
      const walletClient = getWalletClient();
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
      if (
        !network.contracts.factory ||
        network.contracts.factory === '0x0000000000000000000000000000000000000000'
      ) {
        throw new Error(`Factory contract not deployed on ${network.name}`);
      }

      // On all EVM chains (including Arc Network), native msg.value uses 18 decimals
      // (1e18 native wei = 1.0 token / 1.0 USDC) per Circle Arc EVM differences specification.
      const initialBuyWei =
        params.initialBuyAmountEth && params.initialBuyAmountEth !== '0'
          ? parseEther(params.initialBuyAmountEth)
          : 0n;
      const totalValue = network.launchConfig.launchFeeWei + initialBuyWei;

      launchStep.value = 'awaiting_signature';

      const hash = await walletClient.writeContract({
        address: network.contracts.factory,
        abi: launchpadFactoryAbi,
        functionName: 'launchToken',
        args: [
          params.name,
          params.symbol,
          params.logo,
          params.description,
          {
            twitter: params.socials.twitter ?? '',
            telegram: params.socials.telegram ?? '',
            discord: params.socials.discord ?? '',
            website: params.socials.website ?? '',
            farcaster: params.socials.farcaster ?? '',
          },
          initialBuyWei,
        ],
        value: totalValue,
        account,
        chain: walletClient.chain,
      });

      launchTxHash.value = hash;
      launchStep.value = 'confirming';

      const publicClient = getPublicClient();
      let receipt;
      try {
        receipt = await publicClient.waitForTransactionReceipt({
          hash,
          timeout: 120_000,
          retryCount: 10,
          retryDelay: 2000,
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

      // 1. Primary: parse via viem parseEventLogs
      const v1Events = parseEventLogs({
        abi: launchpadFactoryAbi,
        logs: receipt.logs,
        eventName: 'TokenLaunched',
      });

      if (v1Events.length > 0) {
        launchStep.value = 'success';
        launchTokenAddress.value = v1Events[0].args.token;
        return {
          tokenAddress: v1Events[0].args.token,
          poolAddress: v1Events[0].args.pool,
        };
      }

      // 2. Secondary fallback: check each log individually
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: launchpadFactoryAbi,
            eventName: 'TokenLaunched',
            topics: log.topics,
            data: log.data,
          });
          if (decoded?.args?.token) {
            launchStep.value = 'success';
            launchTokenAddress.value = decoded.args.token;
            return {
              tokenAddress: decoded.args.token,
              poolAddress: decoded.args.pool,
            };
          }
        } catch {
          // Continue searching logs
        }
      }

      console.error('[LaunchpadV1] TokenLaunched not found. Receipt logs:', receipt.logs);
      throw new Error(`TokenLaunched event not found in transaction receipt. Hash: ${hash}`);
    } catch (err) {
      launchStep.value = 'error';
      error.value = (err as Error).message;
      return null;
    } finally {
      loading.value = false;
    }
  }

  // ---------------------------------------------------------------------------
  // V2: Launch via Bonding Curve (graduates to Uniswap V4)
  // Uses launchpadV2FactoryAbi from shared-types as the single source of truth (fix HIGH-03).
  // ---------------------------------------------------------------------------

  async function launchTokenV2(params: {
    name: string;
    symbol: string;
    logo: string;
    description: string;
    socials: TokenSocials;
    initialBuyAmountEth?: string;
  }): Promise<{ tokenAddress: `0x${string}`; curveAddress: `0x${string}` } | null> {
    loading.value = true;
    error.value = null;
    launchStep.value = 'validating';
    launchTxHash.value = null;
    launchTokenAddress.value = null;

    try {
      const walletClient = getWalletClient();
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
      const initialBuyWei =
        params.initialBuyAmountEth && params.initialBuyAmountEth !== '0'
          ? parseEther(params.initialBuyAmountEth)
          : 0n;
      const totalValue = network.launchConfig.launchFeeWei + initialBuyWei;

      launchStep.value = 'awaiting_signature';

      const hash = await walletClient.writeContract({
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

      launchTxHash.value = hash;
      launchStep.value = 'confirming';

      const publicClient = getPublicClient();
      let receipt;
      try {
        receipt = await publicClient.waitForTransactionReceipt({
          hash,
          timeout: 120_000,
          retryCount: 10,
          retryDelay: 2000,
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

      // 1. Primary: decode via viem parseEventLogs
      const v2Events = parseEventLogs({
        abi: launchpadV2FactoryAbi,
        logs: receipt.logs,
        eventName: 'TokenLaunchedV2',
      });

      if (v2Events.length > 0) {
        launchStep.value = 'success';
        launchTokenAddress.value = v2Events[0].args.token;
        return {
          tokenAddress: v2Events[0].args.token,
          curveAddress: v2Events[0].args.curve,
        };
      }

      // 2. Secondary fallback: check each log individually with decodeEventLog
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: launchpadV2FactoryAbi,
            eventName: 'TokenLaunchedV2',
            topics: log.topics,
            data: log.data,
          });
          if (decoded?.args?.token) {
            launchStep.value = 'success';
            launchTokenAddress.value = decoded.args.token;
            return {
              tokenAddress: decoded.args.token,
              curveAddress: decoded.args.curve,
            };
          }
        } catch {
          // Continue searching logs
        }
      }

      // 3. Tertiary fallback: if deployed as V1
      const v1Events = parseEventLogs({
        abi: launchpadFactoryAbi,
        logs: receipt.logs,
        eventName: 'TokenLaunched',
      });

      if (v1Events.length > 0) {
        launchStep.value = 'success';
        launchTokenAddress.value = v1Events[0].args.token;
        return {
          tokenAddress: v1Events[0].args.token,
          curveAddress: v1Events[0].args.pool as `0x${string}`,
        };
      }

      console.error('[LaunchpadV2] TokenLaunchedV2 not found. Receipt logs:', receipt.logs);
      throw new Error(`TokenLaunchedV2 event not found in transaction receipt. Hash: ${hash}`);
    } catch (err) {
      launchStep.value = 'error';
      error.value = (err as Error).message;
      return null;
    } finally {
      loading.value = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Router: delegate to V1 or V2 based on the requested version
  // ---------------------------------------------------------------------------

  async function launchToken(
    params: {
      name: string;
      symbol: string;
      logo: string;
      description: string;
      socials: TokenSocials;
      initialBuyAmountEth?: string;
    },
    version: 'v1' | 'v2' = 'v1',
  ) {
    if (version === 'v2') {
      const res = await launchTokenV2(params);
      return res ? { tokenAddress: res.tokenAddress, poolAddress: res.curveAddress } : null;
    }
    return launchTokenV1(params);
  }

  // ---------------------------------------------------------------------------
  // Read: fetch token details from chain
  // ---------------------------------------------------------------------------

  async function fetchTokenDetails(tokenAddress: `0x${string}`) {
    try {
      const client = getPublicClient();
      const [name, symbol, logo, description, pool, graduation] = await Promise.all([
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
        client.readContract({
          address: tokenAddress,
          abi: launchpadTokenAbi,
          functionName: 'liquidityPool',
        }),
        client.readContract({
          address: ROBINHOOD_CHAIN.contracts.factory,
          abi: launchpadFactoryAbi,
          functionName: 'graduationStatus',
          args: [tokenAddress],
        }),
      ]);

      const [pairedPrincipal, threshold, graduated] = graduation;
      const progress =
        Number(threshold) > 0 ? Math.min(1.0, Number(pairedPrincipal) / Number(threshold)) : 0;

      const sqrtPriceX96Result = await client
        .readContract({
          address: pool as `0x${string}`,
          abi: [
            {
              name: 'slot0',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [
                { name: 'sqrtPriceX96', type: 'uint160' },
                { name: 'tick', type: 'int24' },
                { name: 'observationIndex', type: 'uint16' },
                { name: 'observationCardinality', type: 'uint16' },
                { name: 'observationCardinalityNext', type: 'uint16' },
                { name: 'feeProtocol', type: 'uint8' },
                { name: 'unlocked', type: 'bool' },
              ],
            },
          ],
          functionName: 'slot0',
        })
        .catch(() => [2505414483750479299401734n, 0, 0, 0, 0, 0, true] as const);

      const sqrtPriceX96 = sqrtPriceX96Result[0] as bigint;
      const ratio = Number(sqrtPriceX96) / 2 ** 96;
      const token1PerToken0 = ratio * ratio;
      // Assume isToken0 = true for display purposes; the API provides the authoritative value.
      const priceInWeth = token1PerToken0;
      const ethPriceUsd = await getLiveEthPriceUsd();
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
          deployer: tokenAddress,
          pairedToken: ROBINHOOD_CHAIN.contracts.weth,
          poolAddress: pool,
          isToken0: true,
          poolFee: 10000,
          positionId: 1n,
          restrictionsEndBlock: 100n,
          launchBlock: 98n,
          createdAt: Date.now(),
        },
        marketData: {
          address: tokenAddress,
          priceInWeth,
          priceUsd,
          marketCapUsd,
          fdvUsd: marketCapUsd,
          pairedPrincipalWeth: (Number(pairedPrincipal) / 1e18).toFixed(4),
          graduationThresholdWeth: '4.2',
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
      const walletClient = getWalletClient();
      if (!walletClient) throw new Error('No Web3 wallet detected');

      const [account] = await walletClient.getAddresses();
      if (!account) throw new Error('Please connect your wallet');

      const network = getNetworkConfig(walletChainId.value ?? undefined);
      const hash = await walletClient.writeContract({
        address: network.contracts.locker,
        abi: liquidityLockerAbi,
        functionName: 'claimFees',
        args: [tokenAddress],
        account,
        chain: walletClient.chain,
      });

      await getPublicClient().waitForTransactionReceipt({ hash });
      return hash;
    } catch (err) {
      error.value = (err as Error).message;
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
      const walletClient = getWalletClient();
      if (!walletClient) throw new Error('No Web3 wallet detected');

      const [account] = await walletClient.getAddresses();
      if (!account) throw new Error('Please connect your wallet');

      const network = getNetworkConfig(walletChainId.value ?? undefined);
      const hash = await walletClient.writeContract({
        address: network.contracts.locker,
        abi: liquidityLockerAbi,
        functionName: 'setFeeRedirect',
        args: [tokenAddress, redirectAddress],
        account,
        chain: walletClient.chain,
      });

      await getPublicClient().waitForTransactionReceipt({ hash });
      return hash;
    } catch (err) {
      error.value = (err as Error).message;
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
  };
}
