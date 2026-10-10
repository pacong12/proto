<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';
import { PackageOpen } from 'lucide-vue-next';

interface Props {
  title?: string;
  description?: string;
  class?: HTMLAttributes['class'];
}

const props = withDefaults(defineProps<Props>(), {
  title: 'No items found',
  description: 'Nothing to display at this moment.',
});
</script>

<template>
  <div
    :class="
      cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-border bg-card/50 text-muted-foreground space-y-3',
        props.class,
      )
    "
  >
    <div class="rounded-full bg-muted p-3 text-muted-foreground">
      <slot name="icon">
        <PackageOpen class="h-6 w-6" />
      </slot>
    </div>
    <div class="space-y-1">
      <h4 class="text-sm font-semibold text-foreground font-mono">
        {{ props.title }}
      </h4>
      <p class="text-xs text-muted-foreground max-w-sm font-sans">
        {{ props.description }}
      </p>
    </div>
    <div v-if="$slots.action" class="pt-2">
      <slot name="action" />
    </div>
  </div>
</template>
