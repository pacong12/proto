<template>
  <header class="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
      <div class="flex items-center gap-8">
        <a
          href="#"
          @click.prevent="$emit('navigate', 'explore')"
          class="flex items-center gap-2.5 text-xl font-bold tracking-tight text-white"
        >
          <Rocket class="w-6 h-6 text-emerald-400" />
          <span class="text-white">proto</span>
          <span
            class="text-[11px] bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded border border-zinc-800 font-mono"
            >Robinhood L2</span
          >
        </a>
        <nav class="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            @click="$emit('navigate', 'explore')"
            :class="activeTab === 'explore' ? 'text-white' : 'text-zinc-400 hover:text-white'"
            class="flex items-center gap-1.5 transition"
          >
            <Compass class="w-4 h-4" />
            Explore
          </button>
          <button
            @click="$emit('navigate', 'create')"
            :class="activeTab === 'create' ? 'text-white' : 'text-zinc-400 hover:text-white'"
            class="flex items-center gap-1.5 transition"
          >
            <PlusCircle class="w-4 h-4" />
            Create
          </button>
          <button
            @click="$emit('navigate', 'trade')"
            :class="activeTab === 'trade' ? 'text-white' : 'text-zinc-400 hover:text-white'"
            class="flex items-center gap-1.5 transition"
          >
            <ArrowLeftRight class="w-4 h-4" />
            Trade
          </button>
          <button
            @click="$emit('navigate', 'analytics')"
            :class="activeTab === 'analytics' ? 'text-white' : 'text-zinc-400 hover:text-white'"
            class="flex items-center gap-1.5 transition"
          >
            <Activity class="w-4 h-4" />
            Analytics
          </button>
          <button
            @click="$emit('navigate', 'profile')"
            :class="activeTab === 'profile' ? 'text-white' : 'text-zinc-400 hover:text-white'"
            class="flex items-center gap-1.5 transition"
          >
            <User class="w-4 h-4" />
            Profile
          </button>
        </nav>
      </div>

      <div class="flex items-center gap-3">
        <button
          v-if="!account"
          @click="connectWallet"
          class="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm px-4 py-2 rounded-lg transition shadow-sm"
        >
          <Wallet class="w-4 h-4" />
          Connect Wallet
        </button>
        <div
          v-else
          class="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-sm"
        >
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span class="font-mono text-zinc-300">{{ formattedAccount }}</span>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Rocket,
  Compass,
  PlusCircle,
  ArrowLeftRight,
  Activity,
  User,
  Wallet,
} from 'lucide-vue-next';

defineProps<{
  activeTab: string;
}>();

defineEmits<{
  (e: 'navigate', tab: string): void;
}>();

const account = ref<string | null>(null);

const formattedAccount = computed(() => {
  if (!account.value) return '';
  return `${account.value.slice(0, 6)}...${account.value.slice(-4)}`;
});

async function connectWallet() {
  if (typeof window !== 'undefined' && 'ethereum' in window && window.ethereum) {
    try {
      const accounts = await (
        window.ethereum as { request: (args: { method: string }) => Promise<string[]> }
      ).request({
        method: 'eth_requestAccounts',
      });
      account.value = accounts[0] ?? null;
    } catch {
      account.value = null;
    }
  }
}
</script>
