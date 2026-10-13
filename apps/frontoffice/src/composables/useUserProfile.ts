import { ref, computed, type Ref } from 'vue';
import { erc20Abi } from 'viem';
import { apiFetch } from '@/lib/api-client';
import { getPublicClient } from '@/lib/viem-client';
import {
  liquidityLockerAbi,
  UNDEPLOYED,
  type LaunchedTokenEntity,
  type TokenMarketData,
  type TradeEventEntity,
  type NetworkConfig,
} from '@proto/shared-types';
import type { MyLaunchItem, PortfolioPosition, UserActivity } from '@/components/profile/types';

export interface UseUserProfileOptions {
  targetAccount: Ref<string | null>;
  activeNetwork: Ref<NetworkConfig>;
  allTokens:
    | Ref<readonly { token: LaunchedTokenEntity; marketData?: TokenMarketData | null }[]>
    | Readonly<Ref<readonly { token: LaunchedTokenEntity; marketData?: TokenMarketData | null }[]>>;
  getTokenNetwork: (address: string) => NetworkConfig;
}

export function useUserProfile({
  targetAccount,
  activeNetwork,
  allTokens,
  getTokenNetwork,
}: UseUserProfileOptions) {
  const myLaunches = ref<MyLaunchItem[]>([]);
  const portfolioPositions = ref<PortfolioPosition[]>([]);
  const userActivities = ref<UserActivity[]>([]);
  const loadingLaunches = ref(false);
  const loadingPortfolio = ref(false);

  const totalClaimableWeth = computed(() => {
    const sum = myLaunches.value.reduce(
      (acc: number, item: MyLaunchItem) => acc + parseFloat(item.unclaimedWeth || '0'),
      0,
    );
    return sum.toFixed(4);
  });

  // 1. Fetch launches created by the target account
  async function fetchMyLaunches() {
    const target = targetAccount.value;
    if (!target) {
      myLaunches.value = [];
      return;
    }
    loadingLaunches.value = true;
    try {
      const envelope = await apiFetch<{
        success: boolean;
        data: Array<{ token: LaunchedTokenEntity; marketData: TokenMarketData }>;
      }>(`/api/tokens?deployer=${target}`);
      if (envelope.success && Array.isArray(envelope.data)) {
        const publicClient = getPublicClient(activeNetwork.value.chainId);
        const lockerAddr = activeNetwork.value.contracts.locker;
        const hasLocker = lockerAddr && lockerAddr !== UNDEPLOYED;

        const launches = await Promise.all(
          envelope.data.map(async (item) => {
            let redirect: string | null = null;
            let unclaimedWeth = '--';

            if (hasLocker) {
              try {
                const r = (await publicClient.readContract({
                  address: lockerAddr,
                  abi: liquidityLockerAbi,
                  functionName: 'feeRedirects',
                  args: [item.token.address as `0x${string}`],
                })) as string;
                if (r && r !== UNDEPLOYED) {
                  redirect = r;
                }
              } catch {
                // Non-blocking
              }

              if (item.marketData?.isGraduated) {
                try {
                  const { result } = await publicClient.simulateContract({
                    address: lockerAddr,
                    abi: liquidityLockerAbi,
                    functionName: 'claimFees',
                    args: [item.token.address as `0x${string}`],
                    account: target as `0x${string}`,
                  });
                  const [, creatorWethFee] = result as [bigint, bigint];
                  const wethNum = Number(creatorWethFee) / 1e18;
                  unclaimedWeth = wethNum.toFixed(4);
                } catch {
                  // Non-blocking
                }
              }
            }

            return {
              address: item.token.address,
              name: item.token.name,
              symbol: item.token.symbol,
              logo: item.token.logo,
              unclaimedWeth,
              redirect,
            };
          }),
        );
        myLaunches.value = launches;
      } else {
        myLaunches.value = [];
      }
    } catch (e) {
      console.warn('[useUserProfile] Failed to load launches:', (e as Error).message);
      myLaunches.value = [];
    } finally {
      loadingLaunches.value = false;
    }
  }

  // 2. Fetch positions and activities strictly for the target account
  async function fetchUserPositionsAndActivity() {
    const target = targetAccount.value;
    if (!target) {
      portfolioPositions.value = [];
      userActivities.value = [];
      return;
    }
    loadingPortfolio.value = true;

    try {
      const [tradesJson, tokensJson, portfolioJson] = await Promise.all([
        apiFetch<{ success: boolean; data: TradeEventEntity[] }>(
          `/api/trades?trader=${target}&limit=100`,
        ).catch(() => null),
        apiFetch<{
          success: boolean;
          data: Array<{ token: LaunchedTokenEntity; marketData: TokenMarketData }>;
        }>('/api/tokens?limit=100').catch(() => null),
        apiFetch<{ success: boolean; data: PortfolioPosition[] }>(
          `/api/users/${target}/portfolio`,
        ).catch(() => null),
      ]);
      const tokensList: Array<{ token: LaunchedTokenEntity; marketData: TokenMarketData }> =
        tokensJson?.success && Array.isArray(tokensJson.data) ? tokensJson.data : [];

      const tokenMap = new Map<
        string,
        { token: LaunchedTokenEntity; marketData?: TokenMarketData | null }
      >();
      for (const item of allTokens.value) {
        tokenMap.set(item.token.address.toLowerCase(), item);
      }
      for (const item of tokensList) {
        tokenMap.set(item.token.address.toLowerCase(), item);
      }

      const activities: UserActivity[] = [];
      if (tradesJson?.success && Array.isArray(tradesJson.data)) {
        for (const tr of tradesJson.data) {
          if (tr.trader && tr.trader.toLowerCase() !== target) continue;
          const tMeta = tokenMap.get(tr.tokenAddress.toLowerCase());
          const sym = tMeta
            ? tMeta.token.symbol
            : ((tr as TradeEventEntity & { tokenSymbol?: string }).tokenSymbol ?? 'TOKEN');
          activities.push({
            txHash: tr.transactionHash,
            isBuy: tr.isBuy,
            tokenSymbol: sym,
            ethAmount: tr.wethAmount,
            tokenAmount: parseFloat(tr.tokenAmount || '0').toFixed(2),
            timestamp: tr.timestamp,
          });
        }
      }

      userActivities.value = activities;

      // Collect candidate addresses from all sources
      const candidateAddresses = new Set<string>();
      if (tradesJson?.success && Array.isArray(tradesJson.data)) {
        for (const tr of tradesJson.data) {
          if (tr.tokenAddress) candidateAddresses.add(tr.tokenAddress.toLowerCase());
        }
      }
      for (const item of tokensList) {
        candidateAddresses.add(item.token.address.toLowerCase());
      }
      for (const launch of myLaunches.value) {
        candidateAddresses.add(launch.address.toLowerCase());
      }

      // Default portfolio positions from indexer
      const indexedPositionsMap = new Map<string, PortfolioPosition>();
      if (portfolioJson?.success && Array.isArray(portfolioJson.data)) {
        for (const pos of portfolioJson.data) {
          indexedPositionsMap.set(pos.tokenAddress.toLowerCase(), pos);
        }
      }

      // Try on-chain balances with per-token network resilience
      const candidateList = Array.from(candidateAddresses);
      const balancePromises = candidateList.map(async (addr) => {
        const meta = tokenMap.get(addr);
        const chainId = meta
          ? getTokenNetwork(meta.token.address).chainId
          : activeNetwork.value.chainId;
        const client = getPublicClient(chainId);

        try {
          const bal = (await client.readContract({
            address: addr as `0x${string}`,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [target as `0x${string}`],
          })) as bigint;

          if (bal > 0n) {
            const decimals = meta?.token.decimals || 18;
            const num = Number(bal) / 10 ** decimals;
            const price = meta?.marketData?.priceUsd || 0;
            return {
              tokenAddress: addr,
              name: meta?.token.name || 'Token',
              symbol: meta?.token.symbol || 'TOK',
              balanceFormatted: num.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }),
              priceUsd: price,
              valueUsd: num * price,
            };
          }
        } catch {
          // Fallback to indexed position if on-chain call reverts
          return indexedPositionsMap.get(addr) || null;
        }
        return null;
      });

      const settled = await Promise.allSettled(balancePromises);
      const validPositionsMap = new Map<string, PortfolioPosition>();

      // Merge on-chain verified positions
      for (const res of settled) {
        if (res.status === 'fulfilled' && res.value) {
          validPositionsMap.set(res.value.tokenAddress.toLowerCase(), res.value);
        }
      }

      // Also include any indexed positions that weren't checked or where on-chain reverted
      for (const [addr, pos] of indexedPositionsMap.entries()) {
        if (!validPositionsMap.has(addr)) {
          validPositionsMap.set(addr, pos);
        }
      }

      const finalPositions = Array.from(validPositionsMap.values());
      finalPositions.sort((a, b) => b.valueUsd - a.valueUsd);
      portfolioPositions.value = finalPositions;
    } catch (e) {
      console.warn(
        '[useUserProfile] Failed to load positions and activities:',
        (e as Error).message,
      );
    } finally {
      loadingPortfolio.value = false;
    }
  }

  return {
    myLaunches,
    portfolioPositions,
    userActivities,
    loadingLaunches,
    loadingPortfolio,
    totalClaimableWeth,
    fetchMyLaunches,
    fetchUserPositionsAndActivity,
  };
}
