<script setup lang="ts">
import { computed } from 'vue';
import { useColorMode } from '@vueuse/core';
import { Sun, Moon } from 'lucide-vue-next';
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
    class="h-8 w-8 p-0 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-black dark:hover:text-white transition-all cursor-pointer"
    :title="isDark ? t('light') : t('dark')"
    @click="toggleTheme"
  >
    <Sun v-if="isDark" class="h-4 w-4 text-amber-500 transition-transform active:scale-90" />
    <Moon v-else class="h-4 w-4 text-emerald-500 transition-transform active:scale-90" />
    <span class="sr-only">Toggle theme</span>
  </Button>
</template>
