<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { useVModel } from '@vueuse/core';
import { cn } from '@/lib/utils';

const props = defineProps<{
  defaultValue?: string | number;
  modelValue?: string | number;
  class?: HTMLAttributes['class'];
  rows?: number;
  placeholder?: string;
  maxlength?: number;
}>();

const emits = defineEmits<{
  (e: 'update:modelValue', payload: string | number): void;
}>();

const modelValue = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue,
});
</script>

<template>
  <textarea
    v-model="modelValue"
    :rows="props.rows || 3"
    :placeholder="props.placeholder"
    :maxlength="props.maxlength"
    :class="
      cn(
        'flex min-h-[60px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm transition-all duration-150 placeholder:text-muted-foreground hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:border-foreground disabled:cursor-not-allowed disabled:opacity-50 font-sans',
        props.class,
      )
    "
  />
</template>
