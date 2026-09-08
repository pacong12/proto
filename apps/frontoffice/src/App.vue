<template>
  <div
    class="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-emerald-500 selection:text-black"
  >
    <Navbar :activeTab="activeTab" @navigate="handleNavigate" />

    <main class="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
      <ExploreView
        v-if="activeTab === 'explore'"
        @selectToken="handleSelectToken"
        @selectTab="handleNavigate"
      />
      <CreateTokenView v-else-if="activeTab === 'create'" @tokenCreated="handleTokenCreated" />
      <TradeView v-else-if="activeTab === 'trade'" :tokenAddress="selectedTokenAddress" />
      <AnalyticsView v-else-if="activeTab === 'analytics'" />
      <ProfileView v-else-if="activeTab === 'profile'" />
    </main>

    <footer class="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600">
      <p>© 2026 Proto Labs. Non-custodial fixed-supply launch protocol on Robinhood Chain.</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Navbar from './components/Navbar.vue';
import ExploreView from './components/ExploreView.vue';
import CreateTokenView from './components/CreateTokenView.vue';
import TradeView from './components/TradeView.vue';
import AnalyticsView from './components/AnalyticsView.vue';
import ProfileView from './components/ProfileView.vue';
const activeTab = ref('explore');
const selectedTokenAddress = ref<string | undefined>(undefined);

function handleNavigate(tab: string) {
  activeTab.value = tab;
}

function handleSelectToken(address: string) {
  selectedTokenAddress.value = address;
  activeTab.value = 'trade';
}

function handleTokenCreated(address: string) {
  selectedTokenAddress.value = address;
  activeTab.value = 'trade';
}
</script>
