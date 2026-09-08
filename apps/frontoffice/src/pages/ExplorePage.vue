<template>
  <ExploreView @select-token="handleSelectToken" @select-tab="handleSelectTab" />
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import ExploreView from '@/components/ExploreView.vue';

const router = useRouter();

function handleSelectToken(address: string) {
  router.push(`/launchpad/${address}`);
}

function handleSelectTab(tab: string) {
  if (tab === 'create') {
    router.push('/launchpad/create');
  } else {
    router.push(`/${tab}`);
  }
}
</script>
