<script setup lang="ts">
import { computed } from 'vue';
import { useColorMode } from '@vueuse/core';
import { Sun, Moon, Monitor } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const mode = useColorMode({
  emitAuto: true,
  modes: {
    dark: 'dark',
    light: 'light',
  },
  storageKey: 'proto-color-theme',
});

const isDark = computed(() => mode.value === 'dark');
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="outline"
        size="sm"
        class="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-200"
        title="Toggle color theme (Light / Dark / System)"
      >
        <Moon v-if="isDark" class="h-4 w-4 text-emerald-400 transition-all" />
        <Sun v-else class="h-4 w-4 text-amber-500 transition-all" />
        <span class="sr-only">Toggle theme</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-32 bg-zinc-950 border border-zinc-800">
      <DropdownMenuItem @click="mode = 'light'" class="cursor-pointer">
        <Sun class="mr-2 h-3.5 w-3.5 text-amber-500" />
        <span>Light</span>
      </DropdownMenuItem>
      <DropdownMenuItem @click="mode = 'dark'" class="cursor-pointer">
        <Moon class="mr-2 h-3.5 w-3.5 text-emerald-400" />
        <span>Dark</span>
      </DropdownMenuItem>
      <DropdownMenuItem @click="mode = 'auto'" class="cursor-pointer">
        <Monitor class="mr-2 h-3.5 w-3.5 text-zinc-400" />
        <span>System</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
