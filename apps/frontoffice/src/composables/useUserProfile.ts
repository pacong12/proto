import { ref, computed, type Ref } from 'vue';
import { erc20Abi, formatUnits } from 'viem';
import { apiFetch } from '@/lib/api-client';
import { getPublicClient } from '@/lib/viem-client';
import {
  protoFeeSplitterAbi,
  resolveFeeSplitter,
  UNDEPLOYED,
  type LaunchedTokenEntity,
  type TokenMarketData,
  type TradeEventEntity,
  type NetworkConfig,
} from '@goton/shared-types';
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
    const sum = myLaunches.value.reduce((acc: number, item: MyLaunchItem) => {
      const val = parseFloat(item.unclaimedWeth);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    return isNaN(sum) ? '0.0000' : sum.toFixed(4);
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
        const launches = await Promise.all(
          envelope.data.map(async (item) => {
            let redirect: string | null = null;
            let unclaimedWeth = '0.0000';

            const tokenNetwork = getTokenNetwork(item.token.address);
            const tokenClient = getPublicClient(tokenNetwork.chainId);
            // FO-06: read the creator's real accrued fees from the token's splitter instead of
            // simulating the legacy locker (whose fallback reported other tokens' balances).
            try {
              const splitter = await resolveFeeSplitter(
                tokenClient,
                tokenNetwork,
                item.token.address as `0x${string}`,
              );
              if (splitter) {
                const [accrued, recipient, creatorAddr] = await Promise.all([
                  tokenClient.readContract({
                    address: splitter.address,
                    abi: protoFeeSplitterAbi,
                    functionName: 'creatorAccrued',
                  }),
                  tokenClient.readContract({
                    address: splitter.address,
                    abi: protoFeeSplitterAbi,
                    functionName: 'creatorRecipient',
                  }),
                  tokenClient.readContract({
                    address: splitter.address,
                    abi: protoFeeSplitterAbi,
                    functionName: 'creator',
                  }),
                ]);
                const amount = Number(formatUnits(accrued, splitter.quoteDecimals));
                unclaimedWeth = isNaN(amount) ? '0.0000' : amount.toFixed(4);
                if (
                  recipient.toLowerCase() !== creatorAddr.toLowerCase() &&
                  recipient !== UNDEPLOYED
                ) {
                  redirect = recipient;
                }
              }
            } catch {
              // Non-blocking
            }

            return {
              address: item.token.address,
              name: item.token.name,
              symbol: item.token.symbol,
              logo: item.token.logo,
              unclaimedWeth,
              redirect,
              taxConfig: item.token.taxConfig,
              isGraduated: Boolean(item.marketData?.isGraduated),
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
