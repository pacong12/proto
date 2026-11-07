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

    <!-- The handle in the URL is still being looked up -->
    <div v-else-if="!targetAccount && resolvingUser" class="py-24 text-center">
      <Loader2 class="w-7 h-7 animate-spin mx-auto text-muted-foreground" />
    </div>

    <!-- User Profile Not Found State -->
    <NotFoundPage
      v-else-if="profileNotFound"
      :title="t('profileNotFoundTitle')"
      :body="t('profileNotFoundBody')"
    />

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
        :claimable-totals="claimableTotals"
        :created-tokens-count="myLaunches.length"
        :is-own-profile="isOwnProfile"
        :active-positions-count="portfolioPositions.length"
        :total-trades-count="userActivities.length"
        :total-trades-capped="totalTradesCapped"
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
      <div class="space-y-6">
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
          <TabsContent value="created" class="mt-4 space-y-4">
            <ProfileCreatedTab
              :my-launches="myLaunches"
              :loading="loadingLaunches"
              :is-own-profile="isOwnProfile"
              :claiming-token="claimingToken"
              :loading-action="Boolean(loadingLaunchpad)"
              @claim="handleClaim"
              @cto="openCtoModal"
            />
          </TabsContent>

          <!-- TAB 2: PORTFOLIO POSITIONS -->
          <TabsContent value="portfolio" class="mt-4">
            <ProfilePortfolioTab
              :portfolio-positions="portfolioPositions"
              :wallet="targetAccount || undefined"
            />
          </TabsContent>

          <!-- TAB 3: TRADING ACTIVITY -->
          <TabsContent value="activity" class="mt-4">
            <ProfileActivityTab :user-activities="userActivities" />
          </TabsContent>

          <!-- TAB 4: DIVIDENDS & VESTING -->
          <TabsContent value="dividends" class="mt-4 space-y-4">
            <ProfileVestingCard
              v-if="isOwnProfile && account"
              ref="vestingCard"
              :account="account"
            />
            <ProfileDividendsTab
              :is-own-profile="isOwnProfile"
              :dividends-loading="dividendsLoading"
              :dividends-totals="dividendsTotals"
              :dividends-has-any="dividendsHasAny"
              :dividends-action-loading="dividendsActionLoading"
              :dividend-entries="dividendEntries"
              :dividends-error="dividendsError"
              @refresh="refreshDividends"
              @claim-all="handleClaimAll"
              @claim-single="handleClaimSingle"
            />
          </TabsContent>
        </Tabs>
      </div>

      <!-- Edit Profile Modal -->
      <EditProfileModal
        v-model:open="editModalOpen"
        :profile-address="targetAccount"
        :initial-data="profileData"
        @save="saveProfile"
        @erase="eraseSocialData"
      />

      <!-- CTO Redirect Modal -->
      <CtoRedirectModal
        v-model:open="ctoModalOpen"
        :token-address="selectedCtoToken"
        :account="account"
        :state="ctoState"
        :state-loading="ctoStateLoading"
        :busy="ctoBusy"
        :error="ctoError"
        @propose="handlePropose"
        @accept="handleAccept"
        @cancel="handleCancel"
        @lock="handleLock"
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
import { Check, AlertCircle, Loader2, RefreshCw, X, Wallet } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import { toast } from '@/components/ui/sonner';
import { useLaunchpad } from '@/composables/useLaunchpad';
import { useWallet } from '@/composables/useWallet';
import { useFeed } from '@/composables/useFeed';
import { useTokenStore } from '@/composables/useTokenStore';
import { useHolderDividends } from '@/composables/useHolderDividends';
import { useUserProfile } from '@/composables/useUserProfile';
import NotFoundPage from '@/pages/NotFoundPage.vue';
import { totalsByCurrency } from '@/lib/currency-totals';
import { setPageSeo } from '@/lib/seo';
import { walletAddress } from '@/lib/wallet-store';
import { getSessionHeaders } from '@/lib/session';
import { resolveSafeUrl } from '@/lib/safe-url';
import { resolveUserAddress, getUserIdentity, registerUserIdentity } from '@/lib/username';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ShareModal, ThreadModal, QuoteModal } from '@/components/feed';
import ProfileHero from './ProfileHero.vue';
import ProfileStats from './ProfileStats.vue';
import ProfilePostsTab from './ProfilePostsTab.vue';
import ProfileCreatedTab from './ProfileCreatedTab.vue';
import ProfileVestingCard from './ProfileVestingCard.vue';
import ProfilePortfolioTab from './ProfilePortfolioTab.vue';
import ProfileDividendsTab from './ProfileDividendsTab.vue';
import ProfileActivityTab from './ProfileActivityTab.vue';
import EditProfileModal from './EditProfileModal.vue';
import CtoRedirectModal from './CtoRedirectModal.vue';
import type { RedirectAction, RedirectState } from '@/lib/cto-redirect';
import type { ProfileStorageData, PortfolioPosition } from './types';
import { isAddress, type FeedCalloutItem } from '@goton/shared-types';
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
  readRedirectState,
  proposeCreatorRecipient,
  acceptCreatorRecipient,
  cancelCreatorRecipient,
  lockCreatorRecipient,
  loading: loadingLaunchpad,
  error: launchpadError,
} = useLaunchpad();
const { fetchUserPosts, toggleLike, toggleRepost } = useFeed();
const { tokens: allTokens, fetchTokens, getTokenNetwork } = useTokenStore();

function isAddressValid(addr: string): boolean {
  return isAddress(addr.trim());
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
const resolvingUser = ref(false);
let resolveRequestId = 0;

async function resolveTargetUser(param: string) {
  const requestId = ++resolveRequestId;
  resolvingUser.value = false;
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
  resolvingUser.value = true;
  try {
    const env = await apiFetch<{ success: boolean; data?: { address: string } }>(
      `/api/users/${encodeURIComponent(param)}`,
    );
    if (requestId !== resolveRequestId) return;
    if (env.success && env.data?.address) {
      const addr = env.data.address.toLowerCase();
      registerUserIdentity(addr);
      resolvedAddressFromApi.value = addr;
    } else {
      resolvedAddressFromApi.value = null;
    }
  } catch (e) {
    if (requestId !== resolveRequestId) return;
    console.warn('[ProfileView] Failed to resolve user identity from API:', (e as Error).message);
    resolvedAddressFromApi.value = null;
  } finally {
    if (requestId === resolveRequestId) resolvingUser.value = false;
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

// A handle nobody has: a wallet address always has a profile page, even an empty one.
const profileNotFound = computed(
  () => hasRouteParam.value && !targetAccount.value && !resolvingUser.value,
);

watch(profileNotFound, (notFound) => {
  setPageSeo(
    route.path,
    notFound ? { title: t('profileNotFoundTitle'), noindex: true } : route.meta.seo,
  );
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

const resolvedAvatarUrl = computed(() => resolveSafeUrl(profileData.value.avatarUrl));
const resolvedBannerUrl = computed(() => resolveSafeUrl(profileData.value.bannerUrl));

const EMPTY_PROFILE: ProfileStorageData = {
  displayName: '',
  bio: '',
  avatarUrl: '',
  bannerUrl: '',
  twitter: '',
  telegram: '',
};

/** Pre-FO-10 profiles lived only in this browser; shown to their owner until saved to the API. */
function readLegacyProfile(address: string): ProfileStorageData | null {
  try {
    const raw = localStorage.getItem(`proto_profile_${address}`);
    return raw ? (JSON.parse(raw) as ProfileStorageData) : null;
  } catch {
    return null;
  }
}

/** FO-10: profiles are stored by the API so every visitor sees the same one. */
async function loadLocalProfile() {
  const address = targetAccount.value;
  if (!address) return;
  try {
    const res = await apiFetch<{ success: boolean; data: { profile: ProfileStorageData | null } }>(
      `/api/profiles/${address}`,
    );
    if (targetAccount.value !== address) return;
    const legacy = isOwnProfile.value ? readLegacyProfile(address) : null;
    profileData.value = res.data?.profile ?? legacy ?? { ...EMPTY_PROFILE };
  } catch {
    profileData.value = (isOwnProfile.value ? readLegacyProfile(address) : null) ?? {
      ...EMPTY_PROFILE,
    };
  }
}

async function saveProfile(data: ProfileStorageData) {
  const address = targetAccount.value;
  if (!address) return;
  actionError.value = null;
  try {
    const res = await apiFetch<{ success: boolean; data: { profile: ProfileStorageData } }>(
      `/api/profiles/${address}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(await getSessionHeaders(address)) },
        body: JSON.stringify(data),
      },
    );
    profileData.value = res.data.profile;
    try {
      localStorage.removeItem(`proto_profile_${address}`);
    } catch {
      // Storage unavailable
    }
  } catch (err) {
    actionError.value = (err as Error).message || 'Failed to save profile';
  }
}

/** GRC-04: deletes this wallet's comments, likes, votes and profile from the API. */
async function eraseSocialData() {
  const address = targetAccount.value;
  if (!address) return;
  actionError.value = null;
  try {
    await apiFetch(`/api/users/${address}/data`, {
      method: 'DELETE',
      headers: await getSessionHeaders(address),
    });
    profileData.value = { ...EMPTY_PROFILE };
    try {
      localStorage.removeItem(`proto_profile_${address}`);
    } catch {
      // Storage unavailable
    }
    editModalOpen.value = false;
    toast.success(t('eraseDataDone'));
  } catch (err) {
    actionError.value = (err as Error).message || 'Failed to delete data';
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
  claimableTotals,
  fetchMyLaunches,
  fetchUserPositionsAndActivity,
  totalTradesCapped,
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
const ctoState = ref<RedirectState | null>(null);
const ctoStateLoading = ref(false);
const ctoBusy = ref<RedirectAction | null>(null);
let ctoRequestId = 0;
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
  hasAnyEarned: dividendsHasAny,
  loadDividends,
  claimDividend,
  claimAllDividends,
  reset: resetDividends,
} = useHolderDividends();

async function refreshDividends() {
  const holder = targetAccount.value;
  if (!holder) return;
  resetDividends();
  const tokens = portfolioPositions.value.map((p: PortfolioPosition) => ({
    address: p.tokenAddress as `0x${string}`,
    symbol: p.symbol,
    name: p.name,
  }));
  await loadDividends(holder as `0x${string}`, tokens, (address) => getTokenNetwork(address));
}

const dividendsTotals = computed(() =>
  totalsByCurrency(
    dividendEntries.value.map((e) => ({
      symbol: e.currencySymbol,
      raw: e.earnedWei,
      decimals: e.quoteDecimals,
    })),
    activeNetwork.value.nativeCurrency.symbol,
  ),
);

async function handleClaimSingle(tokenAddress: string) {
  const hash = await claimDividend(tokenAddress as `0x${string}`, getTokenNetwork(tokenAddress));
  if (hash) {
    successTx.value = hash;
  } else if (dividendsError.value) {
    actionError.value = dividendsError.value;
  }
}

async function handleClaimAll() {
  const hashes = await claimAllDividends();
  if (hashes.length > 0) {
    successTx.value = hashes[hashes.length - 1];
  } else if (dividendsError.value) {
    actionError.value = dividendsError.value;
  }
}

const vestingCard = ref<InstanceType<typeof ProfileVestingCard> | null>(null);

async function refreshAllData() {
  void vestingCard.value?.reload();
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
  ctoError.value = null;
  ctoState.value = null;
  ctoStateLoading.value = true;
  ctoModalOpen.value = true;
  void loadCtoState(tokenAddress);
}

/** Reads the token's redirect state; only the latest request may touch the modal. */
async function loadCtoState(tokenAddress: string) {
  const id = ++ctoRequestId;
  try {
    const next = await readRedirectState(
      tokenAddress as `0x${string}`,
      getTokenNetwork(tokenAddress).chainId,
    );
    if (id === ctoRequestId) ctoState.value = next;
  } catch {
    if (id === ctoRequestId) ctoError.value = t('ctoStateUnavailable');
  } finally {
    if (id === ctoRequestId) ctoStateLoading.value = false;
  }
}

/** Sends one redirect transaction, then shows the new on-chain state in the open modal. */
async function runCtoAction(
  action: RedirectAction,
  send: (token: `0x${string}`, chainId: number) => Promise<`0x${string}` | null>,
) {
  const token = selectedCtoToken.value;
  if (!token || ctoBusy.value) return;
  successTx.value = null;
  actionError.value = null;
  ctoError.value = null;
  ctoBusy.value = action;
  try {
    const hash = await send(token as `0x${string}`, getTokenNetwork(token).chainId);
    if (hash) {
      successTx.value = hash;
      if (selectedCtoToken.value === token) await loadCtoState(token);
      toast.success(t('ctoActionDone'));
      void refreshAllData();
    } else if (launchpadError.value) {
      ctoError.value = launchpadError.value;
    }
  } finally {
    ctoBusy.value = null;
  }
}

function handlePropose(recipient: `0x${string}`) {
  return runCtoAction('propose', (token, chainId) =>
    proposeCreatorRecipient(token, recipient, chainId),
  );
}

function handleAccept() {
  return runCtoAction('accept', acceptCreatorRecipient);
}

function handleCancel() {
  return runCtoAction('cancel', cancelCreatorRecipient);
}

function handleLock() {
  return runCtoAction('lock', lockCreatorRecipient);
}

async function handleClaim(tokenAddress: string) {
  successTx.value = null;
  actionError.value = null;
  claimingToken.value = tokenAddress;
  try {
    const hash = await claimFees(
      tokenAddress as `0x${string}`,
      getTokenNetwork(tokenAddress).chainId,
    );
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
</script>
