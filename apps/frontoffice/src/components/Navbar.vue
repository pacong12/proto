<template>
  <header class="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
      <div class="flex items-center gap-8">
        <a href="#" @click.prevent="$emit('navigate', 'explore')" class="flex items-center gap-2 text-xl font-bold tracking-tight text-white">
          <span class="text-emerald-400">proto</span>
          <span class="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700">Robinhood L2</span>
        </a>
        <nav class="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            @click="$emit('navigate', 'explore')"
            :class="activeTab === 'explore' ? 'text-white' : 'text-zinc-400 hover:text-white'"
          >
            Explore
          </button>
          <button
            @click="$emit('navigate', 'create')"
            :class="activeTab === 'create' ? 'text-white' : 'text-zinc-400 hover:text-white'"
          >
            Create
          </button>
          <button
            @click="$emit('navigate', 'trade')"
            :class="activeTab === 'trade' ? 'text-white' : 'text-zinc-400 hover:text-white'"
          >
            Trade
          </button>
          <button
            @click="$emit('navigate', 'analytics')"
            :class="activeTab === 'analytics' ? 'text-white' : 'text-zinc-400 hover:text-white'"
          >
            Analytics
          </button>
        </nav>
      </div>

      <div class="flex items-center gap-3">
        <button
          v-if="!account"
          @click="connectWallet"
          class="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm px-4 py-2 rounded-lg transition"
        >
          Connect Wallet
        </button>
        <div v-else class="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-sm">
          <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span class="font-mono text-zinc-300">{{ formattedAccount }}</span>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

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
      const accounts = (await (window.ethereum as { request: (args: { method: string }) => Promise<string[]> }).request({
        method: 'eth_requestAccounts',
      }));
      account.value = accounts[0] ?? null;
    } catch {
      account.value = null;
    }
  }
}
</script>
