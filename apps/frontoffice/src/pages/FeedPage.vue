<template>
  <FeedView @select-token="handleSelectToken" />
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import FeedView from '@/components/FeedView.vue';

const router = useRouter();

function handleSelectToken(address: string) {
  router.push(`/launchpad/${address}`);
}
</script>
