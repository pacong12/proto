<script setup lang="ts">
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

defineProps<{
  text?: string;
}>();
</script>

<template>
  <HoverCard :open-delay="100" :close-delay="150">
    <HoverCardTrigger as-child>
      <button
        type="button"
        class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors text-[10px] font-mono font-bold cursor-help shrink-0 select-none border border-zinc-300 dark:border-zinc-700"
        aria-label="Info"
      >
        <span>!</span>
      </button>
    </HoverCardTrigger>
    <HoverCardContent
      side="top"
      :side-offset="6"
      class="z-50 w-64 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-xs text-[var(--card-foreground)] shadow-xl leading-relaxed select-none"
    >
      <slot>{{ text }}</slot>
    </HoverCardContent>
  </HoverCard>
</template>
