<template>
  <div
    class="fixed inset-0 z-[100] flex items-start justify-center pt-24 bg-black/60 dark:bg-black/80 backdrop-blur-xs p-4"
    @click.self="$emit('close')"
  >
    <Card
      class="w-full max-w-lg shadow-2xl overflow-hidden p-0 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-2xl"
    >
      <!-- Search Input Header -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <Search class="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
        <Input
          ref="searchInput"
          v-model="query"
          type="text"
          :placeholder="t('searchPlaceholder')"
          class="border-0 shadow-none focus-visible:ring-0 focus-visible:border-0 bg-transparent h-8 text-sm px-0 text-black dark:text-white placeholder:text-zinc-400"
          @keydown.esc="$emit('close')"
          @keydown.enter="handleEnter"
        />
        <Badge
          variant="outline"
          class="font-mono text-[10px] cursor-pointer border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-black dark:hover:text-white"
          @click="$emit('close')"
        >
          ESC
        </Badge>
      </div>

      <!-- Search Results List -->
      <div class="max-h-80 overflow-y-auto p-2">
        <div
          v-if="loading"
          class="flex items-center justify-center py-10 text-xs gap-2 text-zinc-500 dark:text-zinc-400"
        >
          <Loader2 class="w-4 h-4 animate-spin text-emerald-500 dark:text-emerald-400" />
          <span>{{ t('searchingTokens') }}</span>
        </div>

        <Empty
          v-else-if="filteredTokens.length === 0"
          :title="t('noTokensFound')"
          :description="query ? `${t('noMatchingTokens')} '${query}'` : t('typeSearchHint')"
          class="border-0 bg-transparent py-6"
        />

        <ul v-else class="space-y-1">
          <li v-for="item in filteredTokens" :key="item.token.address">
            <button
              @click="selectToken(item.token.address)"
              class="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition text-left group cursor-pointer"
            >
              <div class="flex items-center gap-3 min-w-0">
                <Avatar
                  class="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 shrink-0"
                >
                  <AvatarFallback
                    class="bg-zinc-100 dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-lg"
                  >
                    {{ item.token.symbol.slice(0, 3) }}
                  </AvatarFallback>
                </Avatar>

                <div class="truncate">
                  <div class="flex items-center gap-2">
                    <span
                      class="text-sm font-semibold text-black dark:text-white group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition truncate"
                    >
                      {{ item.token.name }}
                    </span>
                    <span class="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                      ${{ item.token.symbol }}
                    </span>
                  </div>
                  <p class="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 truncate">
                    {{ item.token.address }}
                  </p>
                </div>
              </div>

              <div class="text-right shrink-0 font-mono text-xs ml-4">
                <span class="font-semibold block text-black dark:text-white">
                  ${{ item.marketData.priceUsd.toFixed(8) }}
                </span>
                <span
                  :class="
                    item.marketData.isGraduated
                      ? 'text-emerald-500 dark:text-emerald-400 font-bold'
                      : 'text-zinc-500 dark:text-zinc-400'
                  "
                  class="text-[10px]"
                >
                  {{
                    item.marketData.isGraduated
                      ? t('graduated')
                      : `${(item.marketData.graduationProgress * 100).toFixed(0)}%`
                  }}
                </span>
              </div>
            </button>
          </li>
        </ul>
      </div>

      <!-- Quick Actions Footer with Light & Dark contrast -->
      <div
        class="px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400"
      >
        <span>
          {{ t('navigateHint') }}:
          <kbd
            class="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-1 py-0.5 rounded text-[10px]"
            >↑</kbd
          >
          <kbd
            class="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-1 py-0.5 rounded text-[10px] ml-0.5"
            >↓</kbd
          >
        </span>
        <span>
          {{ t('selectHint') }}:
          <kbd
            class="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5 rounded text-[10px]"
            >ENTER</kbd
          >
        </span>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Search, Loader2 } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Empty } from '@/components/ui/empty';
import type { LaunchedTokenEntity, TokenMarketData } from '@proto/shared-types';

const { t } = useI18n();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'selectToken', address: string): void;
}>();

const query = ref('');
const searchInput = ref<HTMLInputElement | null>(null);
const loading = ref(false);
const tokens = ref<Array<{ token: LaunchedTokenEntity; marketData: TokenMarketData }>>([]);

onMounted(async () => {
  searchInput.value?.focus();
  loading.value = true;
  try {
    const res = await fetch('/api/tokens');
    const envelope = await res.json();
    if (envelope.success && Array.isArray(envelope.data)) {
      tokens.value = envelope.data;
    }
  } catch {
    // Non-blocking
  } finally {
    loading.value = false;
  }
});

const filteredTokens = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return tokens.value.slice(0, 8);
  return tokens.value.filter((item) => {
    return (
      item.token.name.toLowerCase().includes(q) ||
      item.token.symbol.toLowerCase().includes(q) ||
      item.token.address.toLowerCase().includes(q)
    );
  });
});

function selectToken(address: string) {
  emit('selectToken', address);
  emit('close');
}

function handleEnter() {
  if (filteredTokens.value.length > 0) {
    selectToken(filteredTokens.value[0].token.address);
  }
}
</script>
