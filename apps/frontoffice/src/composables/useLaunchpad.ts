import { ref } from 'vue';
import {
  ROBINHOOD_CHAIN,
  launchpadFactoryAbi,
  launchpadTokenAbi,
  type LaunchedTokenEntity,
  type TokenMarketData,
  type TokenSocials,
} from '@proto/shared-types';
import { publicClient, getWalletClient } from '../lib/viem-client';

export function useLaunchpad() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const tokens = ref<Array<{ token: LaunchedTokenEntity; marketData: TokenMarketData }>>([]);

  async function launchToken(params: {
    name: string;
    symbol: string;
    logo: string;
    description: string;
    socials: TokenSocials;
    initialBuyAmountEth?: string;
  }): Promise<{ tokenAddress: `0x${string}`; poolAddress: `0x${string}` } | null> {
    loading.value = true;
    error.value = null;

    try {
      const walletClient = getWalletClient();
      if (!walletClient) throw new Error('No Web3 wallet detected');

      const [account] = await walletClient.getAddresses();
      if (!account) throw new Error('Please connect your wallet');

      const initialBuyWei = params.initialBuyAmountEth ? BigInt(Math.floor(parseFloat(params.initialBuyAmountEth) * 1e18)) : 0n;
      const totalValue = ROBINHOOD_CHAIN.launchConfig.launchFeeWei + initialBuyWei;

      const hash = await walletClient.writeContract({
        address: ROBINHOOD_CHAIN.contracts.factory,
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

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const launchLog = receipt.logs.find((l) => l.address.toLowerCase() === ROBINHOOD_CHAIN.contracts.factory.toLowerCase());

      return {
        tokenAddress: (launchLog?.topics[1] as `0x${string}`) ?? '0x0000000000000000000000000000000000000000',
        poolAddress: (receipt.logs[1]?.address as `0x${string}`) ?? '0x0000000000000000000000000000000000000000',
      };
    } catch (err) {
      error.value = (err as Error).message;
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function fetchTokenDetails(tokenAddress: `0x${string}`) {
    try {
      const [name, symbol, logo, description, pool, graduation] = await Promise.all([
        publicClient.readContract({ address: tokenAddress, abi: launchpadTokenAbi, functionName: 'name' }),
        publicClient.readContract({ address: tokenAddress, abi: launchpadTokenAbi, functionName: 'symbol' }),
        publicClient.readContract({ address: tokenAddress, abi: launchpadTokenAbi, functionName: 'logo' }),
        publicClient.readContract({ address: tokenAddress, abi: launchpadTokenAbi, functionName: 'description' }),
        publicClient.readContract({ address: tokenAddress, abi: launchpadTokenAbi, functionName: 'liquidityPool' }),
        publicClient.readContract({
          address: ROBINHOOD_CHAIN.contracts.factory,
          abi: launchpadFactoryAbi,
          functionName: 'graduationStatus',
          args: [tokenAddress],
        }),
      ]);

      const [pairedPrincipal, threshold, graduated] = graduation;
      const progress = Number(threshold) > 0 ? Math.min(1.0, Number(pairedPrincipal) / Number(threshold)) : 0;

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
          priceInWeth: 0.000000003,
          priceUsd: 0.000009,
          marketCapUsd: 9000,
          fdvUsd: 9000,
          pairedPrincipalWeth: (Number(pairedPrincipal) / 1e18).toFixed(4),
          graduationThresholdWeth: '4.2',
          graduationProgress: progress,
          isGraduated: graduated,
          volume24hUsd: 1540,
        },
      };
    } catch (err) {
      error.value = (err as Error).message;
      return null;
    }
  }

  return {
    loading,
    error,
    tokens,
    launchToken,
    fetchTokenDetails,
  };
}
