<template>
  <div class="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Token Details Column -->
    <div class="lg:col-span-2 space-y-6">
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div class="flex items-start gap-4">
          <div class="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center font-bold text-2xl text-emerald-400 border border-zinc-700">
            {{ currentToken.symbol.slice(0, 3) }}
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-3">
              <h1 class="text-2xl font-bold text-white">{{ currentToken.name }}</h1>
              <span class="text-sm font-mono text-zinc-400">${{ currentToken.symbol }}</span>
            </div>
            <p class="text-xs font-mono text-zinc-500 mt-1 break-all">{{ currentToken.address }}</p>
          </div>
        </div>

        <p class="text-sm text-zinc-300 mt-4">{{ currentToken.description || 'Fixed supply launchpad token on Robinhood Chain.' }}</p>

        <div class="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-zinc-800">
          <div>
            <p class="text-xs text-zinc-500">Price (USD)</p>
            <p class="text-base font-bold text-white font-mono mt-0.5">${{ currentMarketData.priceUsd.toFixed(8) }}</p>
          </div>
          <div>
            <p class="text-xs text-zinc-500">Market Cap</p>
            <p class="text-base font-bold text-white font-mono mt-0.5">${{ currentMarketData.marketCapUsd.toLocaleString() }}</p>
          </div>
          <div>
            <p class="text-xs text-zinc-500">24h Volume</p>
            <p class="text-base font-bold text-white font-mono mt-0.5">${{ currentMarketData.volume24hUsd.toLocaleString() }}</p>
          </div>
        </div>

        <!-- Graduation Progress Bar -->
        <div class="mt-6 pt-6 border-t border-zinc-800 space-y-2">
          <div class="flex justify-between text-xs">
            <span class="text-zinc-400">Graduation Progress ({{ currentMarketData.pairedPrincipalWeth }} / {{ currentMarketData.graduationThresholdWeth }} ETH)</span>
            <span class="font-mono font-medium text-emerald-400">{{ (currentMarketData.graduationProgress * 100).toFixed(1) }}%</span>
          </div>
          <div class="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
            <div
              class="bg-emerald-500 h-2 rounded-full transition-all"
              :style="{ width: `${currentMarketData.graduationProgress * 100}%` }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Swap Column -->
    <div class="space-y-6">
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div class="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs font-semibold">
            <button
              @click="isBuy = true"
              :class="isBuy ? 'bg-emerald-500 text-black' : 'text-zinc-400 hover:text-white'"
              class="px-4 py-1.5 rounded-md transition"
            >
              Buy
            </button>
            <button
              @click="isBuy = false"
              :class="!isBuy ? 'bg-rose-500 text-white' : 'text-zinc-400 hover:text-white'"
              class="px-4 py-1.5 rounded-md transition"
            >
              Sell
            </button>
          </div>

          <div class="text-xs font-mono text-zinc-400 flex items-center gap-1">
            <span>Slippage:</span>
            <span class="text-white">1.0%</span>
          </div>
        </div>

        <div class="space-y-1.5">
          <div class="flex justify-between text-xs text-zinc-400">
            <span>You pay</span>
            <span class="font-mono">{{ isBuy ? 'ETH' : currentToken.symbol }}</span>
          </div>
          <input
            v-model="amountIn"
            type="number"
            step="0.001"
            placeholder="0.0"
            class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-3 text-lg font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div class="space-y-1.5">
          <div class="flex justify-between text-xs text-zinc-400">
            <span>You receive (estimated)</span>
            <span class="font-mono">{{ isBuy ? currentToken.symbol : 'ETH' }}</span>
          </div>
          <div class="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-lg px-3.5 py-3 text-lg font-mono text-zinc-400">
            {{ estimatedOutput }}
          </div>
        </div>

        <button
          @click="handleSwap"
          :disabled="isSwapping || !amountIn"
          :class="isBuy ? 'bg-emerald-500 hover:bg-emerald-400 text-black' : 'bg-rose-500 hover:bg-rose-400 text-white'"
          class="w-full disabled:opacity-50 font-bold py-3.5 rounded-lg transition"
        >
          {{ isSwapping ? 'Executing Swap...' : (isBuy ? `Buy ${currentToken.symbol}` : `Sell ${currentToken.symbol}`) }}
        </button>

        <div v-if="swapSuccessTx" class="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800 rounded-lg p-3 break-all">
          Swap Confirmed: {{ swapSuccessTx }}
        </div>
        <div v-if="swapError" class="text-xs text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg p-3">
          {{ swapError }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSwap } from '../composables/useSwap';
import type { LaunchedTokenEntity, TokenMarketData } from '@proto/shared-types';

const props = defineProps<{
  tokenAddress?: string;
}>();

const { executeSwap, isSwapping, swapError } = useSwap();

const isBuy = ref(true);
const amountIn = ref('0.05');
const swapSuccessTx = ref<string | null>(null);

const currentToken = ref<LaunchedTokenEntity>({
  address: (props.tokenAddress as `0x${string}`) || '0x39dBED3a2bd333467115dE45665cC57F813C4571',
  name: 'Pons Token',
  symbol: 'PONS',
  decimals: 18,
  totalSupply: '1000000000000000000000000000',
  logo: 'ipfs://pons',
  description: '100% of fees go back to Pons community buyback and burn.',
  socials: { twitter: 'https://x.com/ponsdotfamily' },
  deployer: '0x1111111111111111111111111111111111111111',
  pairedToken: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
  poolAddress: '0x10CC6BD38112cAc182db90B6a71d8Bb5939526bA',
  isToken0: true,
  poolFee: 10000,
  positionId: 1n,
  restrictionsEndBlock: 100n,
  launchBlock: 98n,
  createdAt: Date.now(),
});

const currentMarketData = ref<TokenMarketData>({
  address: currentToken.value.address,
  priceInWeth: 0.0000000042,
  priceUsd: 0.0000126,
  marketCapUsd: 12600,
  fdvUsd: 12600,
  pairedPrincipalWeth: '4.2000',
  graduationThresholdWeth: '4.2',
  graduationProgress: 1.0,
  isGraduated: true,
  volume24hUsd: 48200,
});

const estimatedOutput = computed(() => {
  const input = parseFloat(amountIn.value) || 0;
  if (isBuy.value) {
    const tokens = input / currentMarketData.value.priceInWeth;
    return `${tokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currentToken.value.symbol}`;
  } else {
    const weth = input * currentMarketData.value.priceInWeth;
    return `${weth.toFixed(6)} ETH`;
  }
});

async function handleSwap() {
  swapSuccessTx.value = null;
  const hash = await executeSwap({
    tokenAddress: currentToken.value.address,
    isBuy: isBuy.value,
    amountInEth: amountIn.value,
  });

  if (hash) {
    swapSuccessTx.value = hash;
  }
}
</script>
