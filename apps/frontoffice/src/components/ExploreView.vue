<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <Sparkles class="w-5 h-5 text-emerald-400" />
          <h1 class="text-3xl font-bold tracking-tight text-white">Explore Launches</h1>
        </div>
        <p class="text-zinc-400 text-sm mt-1">
          Fixed-supply tokens climbing toward graduation on Robinhood Chain.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <TabsRoot
          v-model="activeFilter"
          class="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs"
        >
          <TabsList class="flex gap-1">
            <TabsTrigger
              v-for="f in ['Recent buys', 'Newest', 'Market cap', 'Volume']"
              :key="f"
              :value="f"
              class="px-3 py-1.5 rounded-md font-medium transition data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 hover:text-zinc-200"
            >
              {{ f }}
            </TabsTrigger>
          </TabsList>
        </TabsRoot>

        <button
          @click="$emit('selectTab', 'create')"
          class="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm px-4 py-2 rounded-lg transition"
        >
          <Plus class="w-4 h-4" />
          Create Token
        </button>
      </div>
    </div>

    <!-- Token Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="item in displayTokens"
        :key="item.token.address"
        @click="$emit('selectToken', item.token.address)"
        class="group bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between"
      >
        <div>
          <div class="flex items-start gap-3">
            <div
              class="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-lg text-emerald-400 border border-zinc-700 group-hover:border-emerald-500/50 transition"
            >
              {{ item.token.symbol.slice(0, 3) }}
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="font-bold text-white text-base truncate">{{ item.token.name }}</h2>
              <p class="text-xs font-mono text-zinc-400">${{ item.token.symbol }}</p>
            </div>
            <span
              v-if="item.marketData.isGraduated"
              class="flex items-center gap-1 text-[11px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-medium"
            >
              <CheckCircle class="w-3 h-3" />
              Graduated
            </span>
          </div>

          <p class="text-xs text-zinc-400 mt-3 line-clamp-2 leading-relaxed">
            {{ item.token.description || 'Fixed-supply token on Robinhood Chain.' }}
          </p>
        </div>

        <div class="mt-5 space-y-3 pt-4 border-t border-zinc-800/80">
          <div class="flex justify-between text-xs">
            <span class="text-zinc-400 flex items-center gap-1">
              <Coins class="w-3.5 h-3.5 text-zinc-500" />
              Market Cap
            </span>
            <span class="font-mono font-medium text-white"
              >${{ item.marketData.marketCapUsd.toLocaleString() }}</span
            >
          </div>
          <div class="flex justify-between text-xs">
            <span class="text-zinc-400 flex items-center gap-1">
              <Flame class="w-3.5 h-3.5 text-emerald-400" />
              Graduation (4.2 ETH)
            </span>
            <span class="font-mono font-medium text-emerald-400"
              >{{ (item.marketData.graduationProgress * 100).toFixed(1) }}%</span
            >
          </div>

          <!-- Radix Vue Progress -->
          <ProgressRoot
            :model-value="item.marketData.graduationProgress * 100"
            class="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-800"
          >
            <ProgressIndicator
              class="h-full bg-emerald-500 rounded-full transition-all duration-300"
              :style="{
                transform: `translateX(-${100 - item.marketData.graduationProgress * 100}%)`,
              }"
            />
          </ProgressRoot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { TabsRoot, TabsList, TabsTrigger, ProgressRoot, ProgressIndicator } from 'radix-vue';
import { Sparkles, Plus, CheckCircle, Coins, Flame } from 'lucide-vue-next';
import type { LaunchedTokenEntity, TokenMarketData } from '@proto/shared-types';

defineEmits<{
  (e: 'selectToken', address: string): void;
  (e: 'selectTab', tab: string): void;
}>();

const activeFilter = ref('Recent buys');

const displayTokens = ref<Array<{ token: LaunchedTokenEntity; marketData: TokenMarketData }>>([
  {
    token: {
      address: '0x39dBED3a2bd333467115dE45665cC57F813C4571',
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
      createdAt: Date.now() - 3600000,
    },
    marketData: {
      address: '0x39dBED3a2bd333467115dE45665cC57F813C4571',
      priceInWeth: 0.0000000042,
      priceUsd: 0.0000126,
      marketCapUsd: 12600,
      fdvUsd: 12600,
      pairedPrincipalWeth: '4.2000',
      graduationThresholdWeth: '4.2',
      graduationProgress: 1.0,
      isGraduated: true,
      volume24hUsd: 48200,
    },
  },
  {
    token: {
      address: '0xab093dEF657F15dF31b33922A95e047aDd645B29',
      name: 'Robinhood Alpha',
      symbol: 'RALPHA',
      decimals: 18,
      totalSupply: '1000000000000000000000000000',
      logo: 'ipfs://ralpha',
      description: 'The first community memecoin on Robinhood L2.',
      socials: { twitter: 'https://x.com/ralpha' },
      deployer: '0x2222222222222222222222222222222222222222',
      pairedToken: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
      poolAddress: '0x3333333333333333333333333333333333333333',
      isToken0: true,
      poolFee: 10000,
      positionId: 2n,
      restrictionsEndBlock: 102n,
      launchBlock: 100n,
      createdAt: Date.now() - 1800000,
    },
    marketData: {
      address: '0xab093dEF657F15dF31b33922A95e047aDd645B29',
      priceInWeth: 0.0000000018,
      priceUsd: 0.0000054,
      marketCapUsd: 5400,
      fdvUsd: 5400,
      pairedPrincipalWeth: '2.1000',
      graduationThresholdWeth: '4.2',
      graduationProgress: 0.5,
      isGraduated: false,
      volume24hUsd: 12400,
    },
  },
]);
</script>
