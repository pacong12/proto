<template>
  <div
    class="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-foreground selection:text-background"
  >
    <Navbar @open-search="searchOpen = true" />

    <main
      :class="isTradeRoute ? 'flex-1 w-full' : 'flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:py-8'"
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
          <div class="flex items-center gap-2">
            <span class="text-foreground font-bold tracking-tight text-lg">proto</span>
          </div>
          <p class="text-xs text-muted-foreground leading-relaxed">
            {{ t('footerSubtitle') }}
          </p>
        </div>

        <!-- Product Links -->
        <div class="space-y-2">
          <h4 class="text-xs font-semibold uppercase tracking-wider text-foreground">
            {{ t('product') }}
          </h4>
          <ul class="space-y-1.5 text-xs text-muted-foreground">
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
              <RouterLink to="/profile" class="hover:text-primary transition">
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
          <h4 class="text-xs font-semibold uppercase tracking-wider text-foreground">
            {{ t('network') }}
          </h4>
          <ul class="space-y-1.5 text-xs text-muted-foreground font-mono">
            <li>{{ activeNetwork.name }} ({{ activeNetwork.chainId }})</li>
            <li>Uniswap V3 Factory (1% Fee)</li>
            <li>Direct Permanent Lock</li>
            <li>70% Creator / 30% Protocol</li>
          </ul>
        </div>

        <!-- Legal & Privacy Policy Modal Trigger -->
        <div class="space-y-2">
          <h4 class="text-xs font-semibold uppercase tracking-wider text-foreground">
            {{ t('legal') }}
          </h4>
          <ul class="space-y-1.5 text-xs text-muted-foreground">
            <li>
              <RouterLink to="/terms-of-service" class="hover:text-primary transition">
                {{ t('termsOfService') }}
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/privacy-policy" class="hover:text-primary transition">
                {{ t('privacyPolicy') }}
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/cookie-policy" class="hover:text-primary transition">
                {{ t('cookiePolicy') }}
              </RouterLink>
            </li>
          </ul>
          <p class="text-[11px] leading-relaxed text-muted-foreground pt-2">
            {{ t('footerDisclaimer') }}
          </p>
        </div>
      </div>

      <div
        class="max-w-7xl mx-auto pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground"
      >
        <p>{{ t('copyright') }}</p>
        <div class="flex items-center gap-4 text-xs">
          <a
            href="https://x.com/protodotfun"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-foreground transition font-mono flex items-center gap-1"
          >
            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
              />
            </svg>
            <span>@protodotfun</span>
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
    <PrivacyDialog v-model:open="privacyOpen" @accept="handlePrivacyAccepted" />
    <CookieConsentBanner />
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, onMounted, onUnmounted, ref, watch, computed } from 'vue';
import { useRouter, useRoute, RouterLink, RouterView } from 'vue-router';
import { ExternalLink, BookOpen } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import Navbar from './components/Navbar.vue';
import { walletAddress, walletModalOpen } from './lib/wallet-store';
import { useWallet } from './composables/useWallet';

const WalletModal = defineAsyncComponent(() => import('./components/WalletModal.vue'));
const SearchDialog = defineAsyncComponent(() => import('./components/SearchDialog.vue'));
const PrivacyDialog = defineAsyncComponent(() => import('./components/PrivacyDialog.vue'));
const CookieConsentBanner = defineAsyncComponent(
  () => import('./components/CookieConsentBanner.vue'),
);

const { t } = useI18n();
const { activeNetwork } = useWallet();
const router = useRouter();
const route = useRoute();
const docsUrl = import.meta.env.VITE_DOCS_URL || 'https://docs.proto.family';

// Trade page uses full-width terminal layout — no outer max-width / padding
const isTradeRoute = computed(
  () => route.name === 'trade' || route.path.startsWith('/launchpad/0x'),
);

const PRIVACY_STORAGE_KEY = 'proto_privacy_policy_accepted_v1';

const searchOpen = ref(false);
const privacyOpen = ref(false);

function handleSelectToken(address: string) {
  router.push(`/launchpad/${address}`);
}

function handlePrivacyAccepted() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PRIVACY_STORAGE_KEY, 'true');
    } catch {
      // Non-blocking
    }
  }
}

function checkPrivacyOnConnect() {
  if (typeof window === 'undefined') return;
  try {
    const accepted = localStorage.getItem(PRIVACY_STORAGE_KEY) === 'true';
    if (!accepted && walletAddress.value) {
      privacyOpen.value = true;
    }
  } catch {
    // Non-blocking
  }
}

watch(walletAddress, (addr) => {
  if (addr) {
    checkPrivacyOnConnect();
  }
});

function handleKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    searchOpen.value = !searchOpen.value;
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  checkPrivacyOnConnect();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>
