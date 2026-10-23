<template>
  <div
    class="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-foreground selection:text-background"
  >
    <MaintenanceBanner />
    <Navbar @open-search="searchOpen = true" />

    <main
      :class="
        isTradeRoute
          ? 'flex-1 w-full min-h-[100dvh]'
          : 'flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:py-8 min-h-[100dvh]'
      "
    >
      <RouterView />
    </main>

    <!-- Footer with real router navigation -->
    <footer
      class="border-t border-border bg-card text-muted-foreground py-10 sm:py-12 px-4 mt-12 transition-colors"
    >
      <div
        class="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8 text-sm"
      >
        <!-- Brand Info -->
        <div class="space-y-3">
          <div class="flex items-center gap-2.5">
            <img
              src="/logo-pink.svg"
              alt="goton"
              draggable="false"
              oncontextmenu="return false;"
              class="w-6 h-6 object-contain shrink-0 select-none pointer-events-none"
            />
            <span class="text-foreground font-bold tracking-tight text-xl">goton</span>
          </div>
          <p class="text-sm text-muted-foreground leading-relaxed">
            {{ t('footerSubtitle') }}
          </p>
        </div>

        <!-- Product Links -->
        <div class="space-y-2">
          <h2 class="text-sm font-semibold uppercase tracking-wider text-foreground">
            {{ t('product') }}
          </h2>
          <ul class="space-y-2 text-sm text-muted-foreground">
            <li>
              <RouterLink to="/launchpad" class="hover:text-primary transition">
                {{ t('explore') }}
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/launchpad/create" class="hover:text-primary transition">
                {{ t('create') }}
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/memestock" class="hover:text-primary transition">
                {{ t('memestock') }}
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/analytics" class="hover:text-primary transition">
                {{ t('analytics') }}
              </RouterLink>
            </li>
            <li>
              <RouterLink :to="userProfileUrl" class="hover:text-primary transition">
                {{ t('profile') }}
              </RouterLink>
            </li>
            <li>
              <a
                :href="docsUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-primary transition inline-flex items-center gap-1"
              >
                <span>Docs</span>
                <ExternalLink class="w-3 h-3 text-muted-foreground" />
              </a>
            </li>
          </ul>
        </div>

        <!-- Resources & Network -->
        <div class="space-y-2">
          <h2 class="text-sm font-semibold uppercase tracking-wider text-foreground">
            {{ t('network') }}
          </h2>
          <ul class="space-y-2 text-sm text-muted-foreground">
            <li>{{ activeNetwork.name }} ({{ activeNetwork.chainId }})</li>
            <li>{{ t(isArcFooter ? 'footerPoolFromLaunch' : 'footerCurveToV4') }}</li>
            <li>{{ t('footerLiquidityLocked') }}</li>
            <li>{{ t(isArcFooter ? 'footerSplitArc' : 'footerSplitRobinhood') }}</li>
          </ul>
        </div>

        <!-- Legal & Privacy Policy Modal Trigger -->
        <div class="space-y-2">
          <h2 class="text-sm font-semibold uppercase tracking-wider text-foreground">
            {{ t('legal') }}
          </h2>
          <ul class="space-y-2 text-sm text-muted-foreground">
            <li>
              <a
                :href="legalUrl('terms-of-service', locale)"
                target="_blank"
                rel="noopener"
                class="hover:text-primary transition"
              >
                {{ t('termsOfService') }}
              </a>
            </li>
            <li>
              <a
                :href="legalUrl('privacy-policy', locale)"
                target="_blank"
                rel="noopener"
                class="hover:text-primary transition"
              >
                {{ t('privacyPolicy') }}
              </a>
            </li>
            <li>
              <a
                :href="legalUrl('cookie-policy', locale)"
                target="_blank"
                rel="noopener"
                class="hover:text-primary transition"
              >
                {{ t('cookiePolicy') }}
              </a>
            </li>
            <li>
              <button
                type="button"
                class="hover:text-primary transition cursor-pointer"
                @click="cookieSettingsOpen = true"
              >
                {{ t('cookieSettings') }}
              </button>
            </li>
          </ul>
          <p class="text-xs leading-relaxed text-muted-foreground pt-2">
            {{ t('footerDisclaimer') }}
          </p>
        </div>
      </div>

      <div
        class="max-w-7xl mx-auto pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground"
      >
        <p>{{ t('copyright') }}</p>
        <div class="flex items-center gap-4 text-sm">
          <a
            href="https://x.com/gotondotfun"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-foreground transition flex items-center gap-1 font-medium"
          >
            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
              />
            </svg>
            <span>@gotondotfun</span>
          </a>
          <span>•</span>
          <a
            :href="docsUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-foreground transition flex items-center gap-1"
          >
            <BookOpen class="w-3.5 h-3.5" />
            <span>{{ t('docs') || 'Docs' }}</span>
          </a>
          <span>•</span>
          <a
            :href="activeNetwork.blockExplorer"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-foreground transition"
          >
            {{ t('explorer') }}
          </a>
        </div>
      </div>
    </footer>

    <!-- Global Overlays -->
    <WalletModal v-if="walletModalOpen" />
    <SearchDialog v-if="searchOpen" @close="searchOpen = false" @select-token="handleSelectToken" />
    <PrivacyDialog
      v-model:open="termsPromptOpen"
      @accept="acceptTerms"
      @decline="handleTermsDeclined"
    />
    <CookieConsentBanner />
    <Toaster />
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, onMounted, onUnmounted, ref, watch, computed } from 'vue';
import { useRouter, useRoute, RouterLink, RouterView } from 'vue-router';
import { ExternalLink, BookOpen } from 'lucide-vue-next';
import { ARC_CHAIN_ID } from '@goton/shared-types';
import { useI18n } from '@/lib/i18n';
import { legalUrl, resolveDocsUrl } from '@/lib/site';
import Navbar from './components/Navbar.vue';
import MaintenanceBanner from './components/MaintenanceBanner.vue';
import { Toaster } from '@/components/ui/sonner';
import { walletAddress, walletModalOpen } from './lib/wallet-store';
import { useWallet } from './composables/useWallet';
import { useOrderNotifications } from './composables/useOrderNotifications';
import { getUserIdentity } from './lib/username';
import { acceptTerms, cookieSettingsOpen, termsAccepted, termsPromptOpen } from './lib/consent';

const WalletModal = defineAsyncComponent(() => import('./components/WalletModal.vue'));
const SearchDialog = defineAsyncComponent(() => import('./components/SearchDialog.vue'));
const PrivacyDialog = defineAsyncComponent(() => import('./components/PrivacyDialog.vue'));
const CookieConsentBanner = defineAsyncComponent(
  () => import('./components/CookieConsentBanner.vue'),
);

const { t, locale } = useI18n();
const { activeNetwork, disconnectWallet, account } = useWallet();
const isArcFooter = computed(() => activeNetwork.value.chainId === ARC_CHAIN_ID);
const router = useRouter();
// Toast when one of the connected wallet's limit / TP / SL orders fills, on any page.
useOrderNotifications(account, router, t);
const route = useRoute();
const docsUrl = computed(() => resolveDocsUrl());

const userProfileUrl = computed(() => {
  if (walletAddress.value) {
    return `/${getUserIdentity(walletAddress.value).name}`;
  }
  return '/launchpad';
});

// Trade page uses full-width terminal layout — no outer max-width / padding
const isTradeRoute = computed(
  () => route.name === 'trade' || route.path.startsWith('/launchpad/0x'),
);

const searchOpen = ref(false);

function handleSelectToken(address: string) {
  router.push(`/launchpad/${address}`);
}

// Ask for the terms as soon as a wallet connects; signing and sending also require them.
function promptTermsIfConnected() {
  if (!termsAccepted.value && walletAddress.value) termsPromptOpen.value = true;
}

function handleTermsDeclined() {
  void disconnectWallet();
}

watch(walletAddress, (addr) => {
  if (addr) promptTermsIfConnected();
});

function handleKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    searchOpen.value = !searchOpen.value;
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  promptTermsIfConnected();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>
