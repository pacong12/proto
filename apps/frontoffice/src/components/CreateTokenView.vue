<template>
  <div class="max-w-2xl mx-auto space-y-6">
    <div>
      <div class="flex items-center gap-2">
        <Rocket class="w-6 h-6 text-emerald-400" />
        <h1 class="text-3xl font-bold tracking-tight text-white">Launch a Token</h1>
      </div>
      <p class="text-zinc-400 text-sm mt-1">
        Deploy a fixed-supply token into permanently locked Uniswap V3 liquidity on Robinhood Chain.
      </p>
    </div>

    <form
      @submit.prevent="handleLaunch"
      class="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5"
    >
      <div class="space-y-1.5">
        <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-400"
          >Token Name</label
        >
        <input
          v-model="form.name"
          type="text"
          placeholder="e.g. Proto Rocket"
          required
          class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div class="space-y-1.5">
        <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-400"
          >Ticker / Symbol</label
        >
        <input
          v-model="form.symbol"
          type="text"
          placeholder="e.g. PROT"
          required
          class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 uppercase font-mono"
        />
      </div>

      <div class="space-y-1.5">
        <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-400"
          >Description</label
        >
        <textarea
          v-model="form.description"
          rows="3"
          placeholder="Describe your project, thesis, or community..."
          class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
        ></textarea>
      </div>

      <div class="space-y-1.5">
        <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-400"
          >Logo IPFS URI</label
        >
        <input
          v-model="form.logo"
          type="text"
          placeholder="ipfs://bafybeie..."
          class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 font-mono text-xs"
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-400"
            >X (Twitter)</label
          >
          <input
            v-model="form.twitter"
            type="text"
            placeholder="https://x.com/..."
            class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 text-xs"
          />
        </div>
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-400"
            >Telegram</label
          >
          <input
            v-model="form.telegram"
            type="text"
            placeholder="https://t.me/..."
            class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 text-xs"
          />
        </div>
      </div>

      <div class="pt-4 border-t border-zinc-800 space-y-1.5">
        <div class="flex justify-between items-center">
          <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-400"
            >Creator Initial Buy (Optional)</label
          >
          <span class="text-[11px] text-zinc-500">Pairs directly into initial pool</span>
        </div>
        <input
          v-model="form.initialBuyEth"
          type="number"
          step="0.001"
          min="0"
          placeholder="0.0 ETH"
          class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 font-mono"
        />
      </div>

      <div
        class="bg-zinc-950 border border-zinc-800/80 rounded-lg p-4 space-y-2.5 text-xs text-zinc-400"
      >
        <div class="flex justify-between items-center">
          <span class="flex items-center gap-1.5">
            <Lock class="w-3.5 h-3.5 text-emerald-400" />
            Fixed Total Supply
          </span>
          <span class="text-white font-mono font-medium">1,000,000,000</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="flex items-center gap-1.5">
            <ShieldCheck class="w-3.5 h-3.5 text-emerald-400" />
            Anti-Snipe Window
          </span>
          <span class="text-emerald-400 font-medium">2 Blocks (Max Buy 5.5%, Max Hold 5%)</span>
        </div>
        <div class="flex justify-between items-center">
          <span>Pool Fee Tier</span>
          <span class="text-white font-mono">1% (10000)</span>
        </div>
        <div class="flex justify-between items-center">
          <span>Launch Protocol Fee</span>
          <span class="text-white font-mono">0.0005 ETH</span>
        </div>
        <div class="flex justify-between items-center pt-2 border-t border-zinc-800/60">
          <span>Trading Fee Split</span>
          <span class="text-emerald-400 font-semibold">70% Creator / 30% Protocol</span>
        </div>
      </div>

      <button
        type="submit"
        :disabled="loading"
        class="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3.5 rounded-lg transition shadow-sm"
      >
        <Rocket class="w-4 h-4" />
        {{ loading ? 'Launching onchain...' : 'Launch Token' }}
      </button>

      <div
        v-if="error"
        class="flex items-start gap-2 text-xs text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg p-3"
      >
        <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
        <span>{{ error }}</span>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Rocket, ShieldCheck, Lock, AlertCircle } from 'lucide-vue-next';
import { useLaunchpad } from '../composables/useLaunchpad';

const emit = defineEmits<{
  (e: 'tokenCreated', address: string): void;
}>();

const { launchToken, loading, error } = useLaunchpad();

const form = ref({
  name: '',
  symbol: '',
  description: '',
  logo: '',
  twitter: '',
  telegram: '',
  initialBuyEth: '',
});

async function handleLaunch() {
  const result = await launchToken({
    name: form.value.name,
    symbol: form.value.symbol,
    logo: form.value.logo,
    description: form.value.description,
    socials: {
      twitter: form.value.twitter,
      telegram: form.value.telegram,
    },
    initialBuyAmountEth: form.value.initialBuyEth || undefined,
  });

  if (result) {
    emit('tokenCreated', result.tokenAddress);
  }
}
</script>
