<template>
  <TradeView :token-address="address" />
</template>

<script setup lang="ts">
import TradeView from '@/components/TradeView.vue';

defineProps<{
  address?: string;
}>();
</script>
