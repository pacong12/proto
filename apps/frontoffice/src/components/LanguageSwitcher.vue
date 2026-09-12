<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        class="h-8 px-2.5 text-xs font-semibold gap-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900"
        :title="`Current language: ${currentLocaleOption.name}`"
      >
        <span class="text-sm leading-none">{{ currentLocaleOption.flag }}</span>
        <span class="font-mono uppercase">{{ currentLocaleOption.code }}</span>
      </Button>
    </DropdownMenuTrigger>

    <DropdownMenuContent
      align="end"
      class="w-48 p-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-xl"
    >
      <DropdownMenuLabel
        class="text-[11px] text-zinc-400 px-2 py-1 uppercase tracking-wider font-semibold"
      >
        Select Language
      </DropdownMenuLabel>
      <DropdownMenuSeparator class="my-1 border-zinc-200 dark:border-zinc-800" />

      <DropdownMenuItem
        v-for="item in locales"
        :key="item.code"
        class="flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
        :class="{
          'font-bold text-emerald-500 dark:text-emerald-400 bg-emerald-500/10':
            item.code === locale,
        }"
        @click="setLocale(item.code)"
      >
        <div class="flex items-center gap-2">
          <span class="text-sm leading-none">{{ item.flag }}</span>
          <span>{{ item.nativeName }}</span>
        </div>
        <span class="text-[10px] font-mono text-zinc-400 uppercase">{{ item.code }}</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { useI18n } from '../lib/i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const { locale, locales, setLocale, currentLocaleOption } = useI18n();
</script>
