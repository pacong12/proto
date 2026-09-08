<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <div>
      <h1 class="text-3xl font-bold tracking-tight text-white">Protocol Analytics</h1>
      <p class="text-zinc-400 text-sm mt-1">Real-time onchain metrics and contract deployments on Robinhood Chain.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <p class="text-xs text-zinc-500 uppercase font-semibold">Total Trading Volume</p>
        <p class="text-2xl font-bold font-mono text-white mt-1">$184,520</p>
        <p class="text-xs text-emerald-400 mt-2 font-medium">+14.2% from yesterday</p>
      </div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <p class="text-xs text-zinc-500 uppercase font-semibold">Total Tokens Launched</p>
        <p class="text-2xl font-bold font-mono text-white mt-1">128</p>
        <p class="text-xs text-zinc-400 mt-2 font-medium">100% permanently locked</p>
      </div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <p class="text-xs text-zinc-500 uppercase font-semibold">Protocol Buyback & Burn</p>
        <p class="text-2xl font-bold font-mono text-emerald-400 mt-1">3.45 ETH</p>
        <p class="text-xs text-zinc-400 mt-2 font-medium">80% of protocol fees burned</p>
      </div>
    </div>

    <!-- Contracts Table -->
    <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
      <h2 class="text-base font-bold text-white">Deployed System Contracts (Robinhood Chain ID: 4663)</h2>
      <div class="space-y-3 font-mono text-xs">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800/80">
          <span class="text-zinc-400">Launchpad Factory</span>
          <span class="text-white">{{ ROBINHOOD_CHAIN.contracts.factory }}</span>
        </div>
        <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800/80">
          <span class="text-zinc-400">Liquidity Locker</span>
          <span class="text-white">{{ ROBINHOOD_CHAIN.contracts.locker }}</span>
        </div>
        <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800/80">
          <span class="text-zinc-400">Uniswap V3 Factory</span>
          <span class="text-white">{{ ROBINHOOD_CHAIN.contracts.uniswapV3Factory }}</span>
        </div>
        <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800/80">
          <span class="text-zinc-400">Position Manager</span>
          <span class="text-white">{{ ROBINHOOD_CHAIN.contracts.positionManager }}</span>
        </div>
        <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800/80">
          <span class="text-zinc-400">Swap Router</span>
          <span class="text-white">{{ ROBINHOOD_CHAIN.contracts.swapRouter }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ROBINHOOD_CHAIN } from '@proto/shared-types';
</script>
