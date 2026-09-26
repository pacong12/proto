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
        class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors text-[10px] font-mono font-bold cursor-help shrink-0 select-none border border-border"
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
