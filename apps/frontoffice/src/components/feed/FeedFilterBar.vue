<template>
  <div
    class="px-3 pt-2 pb-1 border-b border-border bg-card/60 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-2"
  >
    <Tabs v-model="filter" class="w-auto min-w-0 md:flex-1">
      <TabsList
        variant="line"
        class="text-sm overflow-x-auto no-scrollbar gap-4 sm:gap-6 border-b-0"
      >
        <TabsTrigger v-for="flt in tabs" :key="flt.key" :value="flt.key">
          {{ flt.label }}
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <!-- Chain Filter (All Chains default / Robinhood / Arc) -->
    <div class="flex items-center gap-1 text-sm self-end md:self-auto pb-1 md:pb-0 shrink-0">
      <Button
        v-for="chainOpt in chains"
        :key="chainOpt.key"
        size="sm"
        :variant="chain === chainOpt.key ? 'default' : 'outline'"
        class="h-7 gap-1.5 px-2.5 rounded-lg"
        @click="chain = chainOpt.key"
      >
        <!-- Overlapping chain icons for All Chains, or single icon -->
        <span
          v-if="chainOpt.icons.length > 1"
          class="inline-flex items-center -space-x-1.5 shrink-0"
        >
          <img
            v-for="(ic, icIdx) in chainOpt.icons"
            :key="ic"
            :src="ic"
            alt=""
            class="w-3.5 h-3.5 object-contain rounded-full border border-background bg-background"
            :style="{ zIndex: chainOpt.icons.length - icIdx }"
          />
        </span>
        <img
          v-else
          :src="chainOpt.icons[0]"
          alt=""
          class="w-3.5 h-3.5 object-contain rounded-full shrink-0"
        />
        <span>{{ chainOpt.label }}</span>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { FeedFilterType } from '@/composables/useFeed';

/** The feed's tabs (all, following, targets, ...) and its chain filter. */
defineProps<{
  tabs: ReadonlyArray<{ key: FeedFilterType; label: string }>;
  chains: ReadonlyArray<{ key: string; label: string; icons: string[] }>;
}>();
const filter = defineModel<FeedFilterType>('filter', { required: true });
const chain = defineModel<string>('chain', { required: true });
</script>
