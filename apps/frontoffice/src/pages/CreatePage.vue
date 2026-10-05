<template>
  <div class="max-w-4xl mx-auto pt-2 sm:pt-4">
    <div
      class="mb-2 inline-flex p-1 bg-muted rounded-2xl border border-border gap-1"
      role="tablist"
      :aria-label="t('launchToken')"
    >
      <Button
        v-for="option in families"
        :key="option.value"
        type="button"
        role="tab"
        size="sm"
        :aria-selected="family === option.value"
        :variant="family === option.value ? 'default' : 'ghost'"
        class="text-xs font-semibold cursor-pointer"
        @click="selectFamily(option.value)"
      >
        {{ t(option.label) }}
      </Button>
    </div>

    <CreateTokenView v-if="family === 'evm'" @token-created="handleTokenCreated" />

    <div v-else class="space-y-8 py-2 sm:py-4">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-foreground">{{ t('launchToken') }}</h1>
        <p class="text-sm mt-1 text-muted-foreground">{{ t('solanaSubtitle') }}</p>
      </div>
      <Card class="p-4 sm:p-8 lg:p-10 border border-border bg-card shadow-sm rounded-3xl">
        <SolanaLaunchView />
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CreateTokenView from '@/components/CreateTokenView.vue';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useI18n } from '@/lib/i18n';

// Loaded on demand so EVM-only visitors never download the Solana launch code.
const SolanaLaunchView = defineAsyncComponent(() => import('@/components/SolanaLaunchView.vue'));

type ChainFamily = 'evm' | 'solana';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const families: Array<{ value: ChainFamily; label: string }> = [
  { value: 'evm', label: 'chainFamilyEvm' },
  { value: 'solana', label: 'chainFamilySolana' },
];

const family = computed<ChainFamily>(() => (route.query.chain === 'solana' ? 'solana' : 'evm'));

function selectFamily(value: ChainFamily) {
  router.replace({ query: { ...route.query, chain: value === 'solana' ? 'solana' : undefined } });
}

function handleTokenCreated(tokenAddress: string) {
  router.push(`/launchpad/${tokenAddress}`);
}
</script>
