<template>
  <div
    class="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-emerald-500 selection:text-black"
  >
    <Navbar @open-search="searchOpen = true" />

    <main class="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
      <RouterView />
    </main>

    <!-- Footer with real router navigation -->
    <footer class="border-t border-zinc-900 bg-zinc-950 text-zinc-400 py-12 px-4 mt-12">
      <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 text-sm">
        <!-- Brand Info -->
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <span class="text-white font-bold tracking-tight text-lg">proto</span>
          </div>
          <p class="text-xs text-zinc-500 leading-relaxed">
            {{ t('footerSubtitle') }}
          </p>
        </div>

        <!-- Product Links -->
        <div class="space-y-2">
          <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            {{ t('product') }}
          </h4>
          <ul class="space-y-1.5 text-xs text-zinc-500">
            <li>
              <RouterLink to="/launchpad" class="hover:text-emerald-400 transition">
                {{ t('explore') }}
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/launchpad/create" class="hover:text-emerald-400 transition">
                {{ t('create') }}
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/memestock" class="hover:text-emerald-400 transition">
                {{ t('memestock') }}
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/analytics" class="hover:text-emerald-400 transition">
                {{ t('analytics') }}
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/profile" class="hover:text-emerald-400 transition">
                {{ t('profile') }}
              </RouterLink>
            </li>
            <li>
              <a
                href="http://localhost:3002"
                rel="noopener noreferrer"
                class="hover:text-emerald-400 transition inline-flex items-center gap-1"
              >
                <span>Docs</span>
                <ExternalLink class="w-3 h-3 text-zinc-600" />
              </a>
            </li>
          </ul>
        </div>

        <!-- Resources & Network -->
        <div class="space-y-2">
          <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            {{ t('network') }}
          </h4>
          <ul class="space-y-1.5 text-xs text-zinc-500 font-mono">
            <li>Robinhood Chain (4663)</li>
            <li>Uniswap V3 Factory (1% Fee)</li>
            <li>Direct Permanent Lock</li>
            <li>70% Creator / 30% Protocol</li>
          </ul>
        </div>

        <!-- Legal & Privacy Policy Modal Trigger -->
        <div class="space-y-2">
          <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            {{ t('legal') }}
          </h4>
          <ul class="space-y-1.5 text-xs text-zinc-500">
            <li>
              <a
                href="/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-emerald-400 transition"
              >
                {{ t('termsOfService') }}
              </a>
            </li>
            <li>
              <a
                href="/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-emerald-400 transition"
              >
                {{ t('privacyPolicy') }}
              </a>
            </li>

            <li>
              <a
                href="/cookie-policy"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-emerald-400 transition"
              >
                {{ t('cookiePolicy') }}
              </a>
            </li>
          </ul>
          <p class="text-[11px] leading-relaxed text-zinc-600 pt-2">
            {{ t('footerDisclaimer') }}
          </p>
        </div>
      </div>

      <div
        class="max-w-7xl mx-auto pt-6 border-t border-zinc-900/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600"
      >
        <p>{{ t('copyright') }}</p>
        <div class="flex items-center gap-4 text-xs">
          <a
            href="https://x.com/protodotfamily"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-zinc-400 transition"
          >
            @protodotfamily
          </a>
          <span>•</span>
          <a
            href="https://robinhoodchain.blockscout.com"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-zinc-400 transition"
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
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter, RouterLink, RouterView } from 'vue-router';
import { ExternalLink } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import Navbar from './components/Navbar.vue';
import WalletModal from './components/WalletModal.vue';
import SearchDialog from './components/SearchDialog.vue';
import PrivacyDialog from './components/PrivacyDialog.vue';
import CookieConsentBanner from './components/CookieConsentBanner.vue';
import { walletAddress, walletModalOpen } from './lib/wallet-store';

const { t } = useI18n();
const router = useRouter();

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
