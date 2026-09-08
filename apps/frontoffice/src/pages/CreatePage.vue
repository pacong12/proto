<template>
  <CreateTokenView @token-created="handleTokenCreated" />
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import CreateTokenView from '@/components/CreateTokenView.vue';

const router = useRouter();

function handleTokenCreated(tokenAddress: string) {
  router.push(`/launchpad/${tokenAddress}`);
}
</script>
