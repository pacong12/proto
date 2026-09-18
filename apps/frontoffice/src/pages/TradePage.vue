<template>
  <TradeView :token-address="targetAddress" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import TradeView from '@/components/TradeView.vue';

const props = defineProps<{
  address?: string;
}>();

const route = useRoute();
const targetAddress = computed(() => props.address || (route.params.address as string) || '');
</script>
