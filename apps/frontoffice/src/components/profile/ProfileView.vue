<template>
  <div class="max-w-5xl mx-auto space-y-6 sm:space-y-8 font-sans">
    <!-- Disconnected Warning Banner using Shadcn Empty -->
    <Empty
      v-if="!targetAccount && !hasRouteParam"
      title="Wallet Not Connected"
      description="Connect your wallet to access your personal dashboard, alpha calls, created tokens, portfolio holdings, and trading activity."
      class="py-16 bg-card/60"
    >
      <template #icon>
        <Wallet class="w-6 h-6 text-muted-foreground" />
      </template>
      <template #action>
        <Button
          size="sm"
          variant="default"
          class="h-10 px-6 font-bold text-xs shrink-0 cursor-pointer rounded-xl shadow-xs"
          @click="openWallet"
        >
          Connect Wallet
        </Button>
      </template>
    </Empty>

    <!-- User Profile Not Found State -->
    <Empty
      v-else-if="!targetAccount && hasRouteParam"
      title="Profile Not Found"
      description="The requested profile handle or wallet address could not be located on this network."
      class="py-16 bg-card/60"
    >
      <template #icon>
        <UserX class="w-6 h-6 text-muted-foreground" />
      </template>
      <template #action>
        <Button
          size="sm"
          variant="outline"
          class="h-10 px-6 font-bold text-xs shrink-0 cursor-pointer rounded-xl border-border"
          @click="router.push('/launchpad')"
        >
          Back to Markets
        </Button>
      </template>
    </Empty>

    <template v-else>
      <!-- 1. Profile Hero: Twitter Cover Banner x Web3 Connected Trader Identity -->
      <ProfileHero
        :profile-address="targetAccount"
        :is-own-profile="isOwnProfile"
        :profile-data="profileData"
        :resolved-avatar-url="resolvedAvatarUrl"
        :resolved-banner-url="resolvedBannerUrl"
        :active-network="activeNetwork"
        :copied-share="copiedShare"
        @edit="editModalOpen = true"
        @share="shareProfile"
      />

      <!-- 2. On-Chain Stats Summary Grid for Target Account -->
      <ProfileStats
        :total-claimable-weth="totalClaimableWeth"
        :native-currency-symbol="activeNetwork.nativeCurrency.symbol"
        :created-tokens-count="myLaunches.length"
        :is-own-profile="isOwnProfile"
        :active-positions-count="portfolioPositions.length"
        :total-trades-count="userActivities.length"
      />

      <!-- Notifications -->
      <div
        v-if="successTx"
        class="text-xs text-foreground bg-black border border-border rounded-xl p-4 flex items-start justify-between gap-2 break-all"
      >
        <div class="flex items-start gap-2">
          <Check class="w-4 h-4 shrink-0 mt-0.5 text-foreground" />
          <span>Transaction Successful! Tx Hash: {{ successTx }}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          class="h-5 w-5 p-0 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
          @click="successTx = null"
        >
          <X class="w-3.5 h-3.5" />
        </Button>
      </div>

      <div
        v-if="actionError"
        class="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start justify-between gap-2 break-words"
      >
        <div class="flex items-start gap-2">
          <AlertCircle class="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
          <span>{{ actionError }}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          class="h-5 w-5 p-0 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
          @click="actionError = null"
        >
          <X class="w-3.5 h-3.5" />
        </Button>
      </div>

      <!-- 3. Main Profile Tabs: Posts & Calls, Created, Portfolio, Activity, Dividends -->
      <Card class="p-5 sm:p-7 border border-border bg-card rounded-3xl shadow-sm space-y-6">
        <Tabs v-model="activeTab" class="w-full">
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-1"
          >
            <TabsList
              variant="line"
              class="flex sm:inline-flex w-full sm:w-auto overflow-x-auto no-scrollbar gap-4 sm:gap-6 border-b-0 text-sm"
            >
              <TabsTrigger value="posts"> Posts & Calls ({{ userPosts.length }}) </TabsTrigger>
              <TabsTrigger value="created">
                {{ t('createdTokens') }} ({{ myLaunches.length }})
              </TabsTrigger>
              <TabsTrigger value="portfolio">
                {{ t('portfolio') }} ({{ portfolioPositions.length }})
              </TabsTrigger>
              <TabsTrigger value="dividends">
                {{ t('dividendsAndVesting') }}
              </TabsTrigger>
              <TabsTrigger value="activity">
                {{ t('activity') }} ({{ userActivities.length }})
              </TabsTrigger>
            </TabsList>

            <Button
              variant="ghost"
              size="sm"
              class="h-8 text-sm text-muted-foreground hover:text-foreground self-end sm:self-auto border border-border cursor-pointer rounded-xl"
              @click="refreshAllData"
            >
              <RefreshCw class="w-3.5 h-3.5 mr-1" :class="{ 'animate-spin': loadingLaunches }" />
              Refresh
            </Button>
          </div>

          <!-- TAB 0: CONNECTED USER POSTS & CALLS -->
          <TabsContent value="posts" class="mt-4">
            <ProfilePostsTab
              :posts="userPosts"
              :loading="loadingPosts"
              :is-own-profile="isOwnProfile"
              :all-tokens="allTokens"
              @reply="openThreadModal"
              @quote="openQuoteModal"
              @like="handleLikePost"
              @repost="handleRepostPost"
              @share="openShareModal"
              @navigate-token="navigateToToken"
            />
          </TabsContent>

          <!-- TAB 1: CREATED TOKENS -->
          <TabsContent value="created" class="mt-4">
            <ProfileCreatedTab
              :my-launches="myLaunches"
              :loading="loadingLaunches"
              :is-own-profile="isOwnProfile"
              :claiming-token="claimingToken"
              :loading-action="Boolean(loadingLaunchpad)"
              :native-currency-symbol="activeNetwork.nativeCurrency.symbol"
              @claim="handleClaim"
              @cto="openCtoModal"
            />
          </TabsContent>

          <!-- TAB 2: PORTFOLIO POSITIONS -->
          <TabsContent value="portfolio" class="mt-4">
            <ProfilePortfolioTab :portfolio-positions="portfolioPositions" />
          </TabsContent>

          <!-- TAB 3: TRADING ACTIVITY -->
          <TabsContent value="activity" class="mt-4">
            <ProfileActivityTab
              :user-activities="userActivities"
              :native-currency-symbol="activeNetwork.nativeCurrency.symbol"
              :block-explorer="activeNetwork.blockExplorer"
            />
          </TabsContent>

          <!-- TAB 4: DIVIDENDS & VESTING -->
          <TabsContent value="dividends" class="mt-4">
            <ProfileDividendsTab
              :is-own-profile="isOwnProfile"
              :dividends-loading="dividendsLoading"
              :dividends-total-formatted="dividendsTotalFormatted"
              :dividends-has-any="dividendsHasAny"
              :dividends-action-loading="dividendsActionLoading"
              :dividend-entries="dividendEntries"
              :dividends-error="dividendsError"
              :native-currency-symbol="activeNetwork.nativeCurrency.symbol"
              @refresh="refreshDividends"
              @claim-all="handleClaimAll"
              @claim-single="handleClaimSingle"
            />
          </TabsContent>
        </Tabs>
      </Card>

      <!-- Edit Profile Modal -->
      <EditProfileModal
        v-model:open="editModalOpen"
        :profile-address="targetAccount"
        :initial-data="profileData"
        @save="saveProfile"
      />

      <!-- CTO Redirect Modal -->
      <CtoRedirectModal
        v-model:open="ctoModalOpen"
        :token-address="selectedCtoToken"
        :loading="Boolean(loadingLaunchpad)"
        :error="ctoError"
        @confirm="handleSetRedirect"
      />

      <!-- Modals for Posts & Threads -->
      <ShareModal
        :is-open="isShareModalOpen"
        :call="activeShareCall"
        @close="isShareModalOpen = false"
      />

      <ThreadModal
        :is-open="isThreadModalOpen"
        :target-call="activeThreadCall"
        :account="connectedAccount"
        :tokens="allTokens"
        @close="isThreadModalOpen = false"
        @toggle-like="handleLikePost"
        @toggle-repost="handleRepostPost"
        @share="openShareModal"
        @reply-posted="onReplyPosted"
      />

      <QuoteModal
        :is-open="isQuoteModalOpen"
        :target-call="activeQuoteCall"
        :account="connectedAccount"
        @close="isQuoteModalOpen = false"
        @quote-posted="loadUserPosts"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Check, AlertCircle, RefreshCw, X, Wallet, UserX } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import { useLaunchpad } from '@/composables/useLaunchpad';
import { useWallet } from '@/composables/useWallet';
import { useFeed } from '@/composables/useFeed';
import { useTokenStore } from '@/composables/useTokenStore';
import { useHolderDividends } from '@/composables/useHolderDividends';
import { useUserProfile } from '@/composables/useUserProfile';
import { walletAddress } from '@/lib/wallet-store';
import { getPublicClient } from '@/lib/viem-client';
import { resolveUserAddress, getUserIdentity, registerUserIdentity } from '@/lib/username';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ShareModal, ThreadModal, QuoteModal } from '@/components/feed';
import {
  ProfileHero,
  ProfileStats,
  ProfilePostsTab,
  ProfileCreatedTab,
  ProfilePortfolioTab,
  ProfileDividendsTab,
  ProfileActivityTab,
  EditProfileModal,
  CtoRedirectModal,
  type ProfileStorageData,
  type MyLaunchItem,
  type PortfolioPosition,
  type UserActivity,
} from './index';
import { erc20Abi } from 'viem';
import {
  liquidityLockerAbi,
  UNDEPLOYED,
  type FeedCalloutItem,
  type LaunchedTokenEntity,
  type TokenMarketData,
  type TradeEventEntity,
} from '@proto/shared-types';
import { apiFetch } from '@/lib/api-client';

const props = defineProps<{
  address?: string;
}>();

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const { account, activeNetwork, openWallet } = useWallet();
const {
  claimFees,
  setFeeRedirect,
  loading: loadingLaunchpad,
  error: launchpadError,
} = useLaunchpad();
const { fetchUserPosts, toggleLike, toggleRepost } = useFeed();
const { tokens: allTokens, fetchTokens, getTokenNetwork } = useTokenStore();

function isAddressValid(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

// Connected wallet account
const connectedAccount = computed<string | null>(() => {
  const addr = walletAddress.value || account.value;
  return addr ? addr.toLowerCase() : null;
});

const routeParam = computed(() => {
  return (
    props.address ||
    (route.params.address as string) ||
    (route.params.username as string) ||
    (route.params.id as string) ||
    ''
  ).trim();
});

const hasRouteParam = computed(() => !!routeParam.value);

const resolvedAddressFromApi = ref<string | null>(null);

async function resolveTargetUser(param: string) {
  if (!param) {
    resolvedAddressFromApi.value = null;
    return;
  }
  if (isAddressValid(param)) {
    const clean = param.toLowerCase();
    resolvedAddressFromApi.value = clean;
    registerUserIdentity(clean);
    return;
  }

  // 1. Check local registry & known deployers/traders
  const known = allTokens.value.map((t) => t.token.deployer).filter(Boolean);
  const local = resolveUserAddress(param, known);
  if (local) {
    resolvedAddressFromApi.value = local.toLowerCase();
    return;
  }

  // 2. Query backend API
  try {
    const env = await apiFetch<{ success: boolean; data?: { address: string } }>(
      `/api/users/${encodeURIComponent(param)}`,
    );
    if (env.success && env.data?.address) {
      const addr = env.data.address.toLowerCase();
      registerUserIdentity(addr);
      resolvedAddressFromApi.value = addr;
    } else {
      resolvedAddressFromApi.value = null;
    }
  } catch (e) {
    console.warn('[ProfileView] Failed to resolve user identity from API:', (e as Error).message);
    resolvedAddressFromApi.value = null;
  }
}

watch(
  routeParam,
  async (newParam) => {
    if (newParam) {
      await resolveTargetUser(newParam);
    }
  },
  { immediate: true },
);

// Profile to display: target route param address (e.g. /u/:address, /:username, or /profile/:username) or connected wallet
const targetAccount = computed<string | null>(() => {
  const param = routeParam.value;
  if (param) {
    if (isAddressValid(param)) {
      return param.toLowerCase();
    }
    if (resolvedAddressFromApi.value) {
      return resolvedAddressFromApi.value;
    }
    const known = allTokens.value.map((t) => t.token.deployer).filter(Boolean);
    const resolved = resolveUserAddress(param, known);
    if (resolved) {
      return resolved;
    }
    return null;
  }
  return connectedAccount.value;
});

const isOwnProfile = computed(() => {
  if (!connectedAccount.value || !targetAccount.value) return false;
  return connectedAccount.value === targetAccount.value;
});

// Profile Metadata for the connected account
const profileData = ref<ProfileStorageData>({
  displayName: '',
  bio: '',
  avatarUrl: '',
  twitter: '',
  telegram: '',
});

function isSafeImageUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('ipfs://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/api/ipfs/')
  );
}

function resolveSafeUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!isSafeImageUrl(trimmed)) return '';
  if (trimmed.startsWith('ipfs://')) {
    const hash = trimmed.replace('ipfs://', '');
    return `/api/ipfs/${hash}`;
  }
  return trimmed;
}

const resolvedAvatarUrl = computed(() => resolveSafeUrl(profileData.value.avatarUrl));
const resolvedBannerUrl = computed(() => resolveSafeUrl(profileData.value.bannerUrl));

function loadLocalProfile() {
  if (!targetAccount.value || typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(`proto_profile_${targetAccount.value}`);
    if (raw) {
      profileData.value = JSON.parse(raw);
    } else {
      profileData.value = {
        displayName: '',
        bio: '',
        avatarUrl: '',
        bannerUrl: '',
        twitter: '',
        telegram: '',
      };
    }
  } catch {
    // Ignore storage parse errors
  }
}

function saveProfile(data: ProfileStorageData) {
  if (!targetAccount.value || typeof window === 'undefined') return;
  try {
    profileData.value = { ...data };
    localStorage.setItem(`proto_profile_${targetAccount.value}`, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

const copiedShare = ref(false);
function shareProfile() {
  if (typeof window === 'undefined' || !targetAccount.value) return;
  const identity = getUserIdentity(targetAccount.value);
  const url = `${window.location.origin}/${identity.name}`;
  navigator.clipboard.writeText(url);
  copiedShare.value = true;
  setTimeout(() => {
    copiedShare.value = false;
  }, 2000);
}

// Target Account Posts & Calls
const userPosts = ref<FeedCalloutItem[]>([]);
const loadingPosts = ref(false);

async function loadUserPosts(): Promise<void> {
  const target = targetAccount.value;
  if (!target) {
    userPosts.value = [];
    return;
  }
  loadingPosts.value = true;
  try {
    userPosts.value = await fetchUserPosts(target, connectedAccount.value || undefined);
  } catch (e) {
    console.warn('[ProfileView] Failed to load user posts:', (e as Error).message);
    userPosts.value = [];
  } finally {
    loadingPosts.value = false;
  }
}

// Modals State for Posts
const isShareModalOpen = ref(false);
const activeShareCall = ref<FeedCalloutItem | null>(null);

const isThreadModalOpen = ref(false);
const activeThreadCall = ref<FeedCalloutItem | null>(null);

const isQuoteModalOpen = ref(false);
const activeQuoteCall = ref<FeedCalloutItem | null>(null);

function openShareModal(call: FeedCalloutItem): void {
  activeShareCall.value = call;
  isShareModalOpen.value = true;
}

function openThreadModal(call: FeedCalloutItem): void {
  activeThreadCall.value = call;
  isThreadModalOpen.value = true;
}

function openQuoteModal(call: FeedCalloutItem): void {
  activeQuoteCall.value = call;
  isQuoteModalOpen.value = true;
}

function onReplyPosted(reply: FeedCalloutItem): void {
  if (activeThreadCall.value) {
    activeThreadCall.value.repliesCount = (activeThreadCall.value.repliesCount || 0) + 1;
  }
  const root = userPosts.value.find((c) => c.id === reply.parentId);
  if (root) {
    root.repliesCount = (root.repliesCount || 0) + 1;
  }
}

async function handleLikePost(commentId: string): Promise<void> {
  if (!connectedAccount.value) {
    openWallet();
    return;
  }
  const res = await toggleLike(commentId, connectedAccount.value);
  if (res) {
    const p = userPosts.value.find((c) => c.id === commentId);
    if (p) {
      p.likesCount = res.likesCount;
      p.isLikedByViewer = res.liked;
    }
  }
}

async function handleRepostPost(commentId: string): Promise<void> {
  if (!connectedAccount.value) {
    openWallet();
    return;
  }
  const res = await toggleRepost(commentId, connectedAccount.value);
  if (res) {
    const p = userPosts.value.find((c) => c.id === commentId);
    if (p) {
      p.repostsCount = res.repostsCount;
      p.isRepostedByViewer = res.reposted;
    }
  }
}

function navigateToToken(address: string): void {
  if (address) {
    router.push(`/launchpad/${address}`);
  }
}

// Connected Account Launches & Portfolio
const {
  myLaunches,
  portfolioPositions,
  userActivities,
  loadingLaunches,
  totalClaimableWeth,
  fetchMyLaunches,
  fetchUserPositionsAndActivity,
} = useUserProfile({
  targetAccount,
  activeNetwork,
  allTokens,
  getTokenNetwork,
});

const activeTab = ref('posts');
const editModalOpen = ref(false);
const ctoModalOpen = ref(false);
const selectedCtoToken = ref<string>('');
const newRecipientAddress = ref<string>('');
const successTx = ref<string | null>(null);
const actionError = ref<string | null>(null);
const ctoError = ref<string | null>(null);
const claimingToken = ref<string | null>(null);

// Holder Dividends & Vesting
const {
  entries: dividendEntries,
  loading: dividendsLoading,
  actionLoading: dividendsActionLoading,
  error: dividendsError,
  totalEarnedFormatted: dividendsTotalFormatted,
  hasAnyEarned: dividendsHasAny,
  loadDividends,
  claimDividend,
  claimAllDividends,
  reset: resetDividends,
} = useHolderDividends();

function getDistributorAddress(): `0x${string}` {
  const addr = activeNetwork.value.contracts.holderFeeDistributor;
  return (addr ?? UNDEPLOYED) as `0x${string}`;
}

async function refreshDividends() {
  const holder = targetAccount.value;
  if (!holder) return;
  resetDividends();
  const tokens = portfolioPositions.value.map((p: PortfolioPosition) => ({
    address: p.tokenAddress as `0x${string}`,
    symbol: p.symbol,
    name: p.name,
  }));
  await loadDividends(
    holder as `0x${string}`,
    tokens,
    getDistributorAddress(),
    activeNetwork.value.chainId,
  );
}

async function handleClaimSingle(tokenAddress: string) {
  const hash = await claimDividend(
    tokenAddress as `0x${string}`,
    getDistributorAddress(),
    activeNetwork.value.chainId,
  );
  if (hash) {
    successTx.value = hash;
  } else if (dividendsError.value) {
    actionError.value = dividendsError.value;
  }
}

async function handleClaimAll() {
  const hashes = await claimAllDividends(getDistributorAddress(), activeNetwork.value.chainId);
  if (hashes.length > 0) {
    successTx.value = hashes[hashes.length - 1];
  } else if (dividendsError.value) {
    actionError.value = dividendsError.value;
  }
}

async function refreshAllData() {
  await Promise.all([fetchMyLaunches(), fetchUserPositionsAndActivity(), loadUserPosts()]);
  await refreshDividends();
}

watch(
  () => [targetAccount.value, route.path],
  ([target, path]) => {
    if (target) {
      loadLocalProfile();
      refreshAllData();

      // Canonical URL rewrite: replace /profile or /u/0x... with /:Username
      const identity = getUserIdentity(target);
      if (
        path === '/profile' ||
        path === '/u' ||
        path === '/user' ||
        (typeof path === 'string' && (path.startsWith('/profile/0x') || path.startsWith('/u/0x')))
      ) {
        router.replace(`/${identity.name}`);
      }
    }
  },
  { immediate: true },
);

watch(
  () => [route.params.address, route.params.id, route.params.username],
  () => {
    loadLocalProfile();
    refreshAllData();
  },
);

onMounted(async () => {
  fetchTokens().catch(() => {});
  loadLocalProfile();
  refreshAllData();
});

function openCtoModal(tokenAddress: string) {
  selectedCtoToken.value = tokenAddress;
  newRecipientAddress.value = '';
  ctoError.value = null;
  ctoModalOpen.value = true;
}

async function handleClaim(tokenAddress: string) {
  successTx.value = null;
  actionError.value = null;
  claimingToken.value = tokenAddress;
  try {
    const hash = await claimFees(tokenAddress as `0x${string}`);
    if (hash) {
      successTx.value = hash;
      await refreshAllData();
    } else if (launchpadError.value) {
      actionError.value = launchpadError.value;
    }
  } catch (err) {
    actionError.value = (err as Error).message || 'Failed to claim fees';
  } finally {
    claimingToken.value = null;
  }
}

async function handleSetRedirect(targetRecipient: string) {
  if (!selectedCtoToken.value || !targetRecipient) return;
  if (!isAddressValid(targetRecipient)) {
    ctoError.value = 'Please enter a valid 20-byte address (0x followed by 40 hex characters).';
    return;
  }
  successTx.value = null;
  actionError.value = null;
  ctoError.value = null;
  try {
    const hash = await setFeeRedirect(
      selectedCtoToken.value as `0x${string}`,
      targetRecipient as `0x${string}`,
    );
    if (hash) {
      successTx.value = hash;
      ctoModalOpen.value = false;
      await refreshAllData();
    } else if (launchpadError.value) {
      ctoError.value = launchpadError.value;
    }
  } catch (err) {
    ctoError.value = (err as Error).message || 'Failed to set fee redirect';
  }
}
</script>
