<script setup lang="ts">
import { computed } from 'vue';
import { useColorMode } from '@vueuse/core';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

const { t } = useI18n();

const mode = useColorMode({
  emitAuto: true,
  modes: {
    dark: 'dark',
    light: 'light',
  },
  storageKey: 'proto-color-theme',
});

const isDark = computed(() => mode.value === 'dark');

function toggleTheme() {
  mode.value = isDark.value ? 'light' : 'dark';
}
</script>

<template>
  <Button
    variant="outline"
    size="sm"
    class="h-8 px-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-black dark:hover:text-white transition-all cursor-pointer"
    :title="isDark ? t('light') : t('dark')"
    @click="toggleTheme"
  >
    <span class="font-mono">{{ isDark ? 'Light' : 'Dark' }}</span>
    <span class="sr-only">Toggle theme</span>
  </Button>
</template>
