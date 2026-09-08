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
            <Rocket class="w-5 h-5 text-emerald-400" />
            <span class="text-white font-bold tracking-tight text-lg">proto</span>
          </div>
          <p class="text-xs text-zinc-500 leading-relaxed">
            Launch and explore fixed-supply tokens on Robinhood Chain. Your wallet submits every
            transaction. proto does not custody assets.
          </p>
        </div>

        <!-- Product Links -->
        <div class="space-y-2">
          <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-300">Product</h4>
          <ul class="space-y-1.5 text-xs text-zinc-500">
            <li>
              <RouterLink to="/launchpad" class="hover:text-emerald-400 transition">
                Explore
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/launchpad/create" class="hover:text-emerald-400 transition">
                Create
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/memestock" class="hover:text-emerald-400 transition">
                Memestock
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/analytics" class="hover:text-emerald-400 transition">
                Analytics
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/profile" class="hover:text-emerald-400 transition">
                Profile
              </RouterLink>
            </li>
            <li>
              <a
                href="http://localhost:3002"
                target="_blank"
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
          <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-300">Network</h4>
          <ul class="space-y-1.5 text-xs text-zinc-500 font-mono">
            <li>Robinhood Chain (4663)</li>
            <li>Uniswap V3 Factory (1% Fee)</li>
            <li>Direct Permanent Lock</li>
            <li>70% Creator / 30% Protocol</li>
          </ul>
        </div>

        <!-- Legal & Privacy Policy Modal Trigger -->
        <div class="space-y-2">
          <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-300">Legal</h4>
          <ul class="space-y-1.5 text-xs text-zinc-500">
            <li>
              <button
                @click="privacyOpen = true"
                class="hover:text-emerald-400 transition underline underline-offset-2 text-left"
              >
                Privacy Policy &amp; Terms
              </button>
            </li>
          </ul>
          <p class="text-[11px] leading-relaxed text-zinc-600 pt-2">
            Transactions are submitted through your wallet and may be irreversible. Tokens can be
            volatile.
          </p>
        </div>
      </div>

      <div
        class="max-w-7xl mx-auto pt-6 border-t border-zinc-900/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600"
      >
        <p>© 2026 Proto Labs, LLC. Fixed-supply token launch protocol on Robinhood Chain.</p>
        <div class="flex items-center gap-4 text-xs">
          <a
            href="https://x.com/ponsdotfamily"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-zinc-400 transition"
          >
            @ponsdotfamily
          </a>
          <span>•</span>
          <a
            href="https://robinhoodchain.blockscout.com"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-zinc-400 transition"
          >
            Explorer
          </a>
        </div>
      </div>
    </footer>

    <!-- Global Overlays -->
    <WalletModal v-if="walletModalOpen" />
    <SearchDialog v-if="searchOpen" @close="searchOpen = false" @select-token="handleSelectToken" />
    <PrivacyDialog v-model:open="privacyOpen" @accept="handlePrivacyAccepted" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter, RouterLink, RouterView } from 'vue-router';
import { Rocket, ExternalLink } from 'lucide-vue-next';
import Navbar from './components/Navbar.vue';
import WalletModal from './components/WalletModal.vue';
import SearchDialog from './components/SearchDialog.vue';
import PrivacyDialog from './components/PrivacyDialog.vue';
import { walletAddress, walletModalOpen } from './lib/wallet-store';

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
