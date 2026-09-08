<template>
  <div
    class="fixed inset-0 z-[100] flex items-start justify-center pt-24 bg-black/75 backdrop-blur-sm p-4"
    @click.self="$emit('close')"
  >
    <Card class="w-full max-w-lg shadow-2xl overflow-hidden p-0 border-zinc-800">
      <!-- Search Input Header -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
        <Search class="w-4 h-4 text-emerald-400 shrink-0" />
        <Input
          ref="searchInput"
          v-model="query"
          type="text"
          placeholder="Search tokens by name, ticker, or address..."
          class="border-0 shadow-none focus-visible:border-0 bg-transparent h-8 text-sm px-0"
          @keydown.esc="$emit('close')"
          @keydown.enter="handleEnter"
        />
        <Badge
          variant="outline"
          class="font-mono text-[10px] cursor-pointer"
          @click="$emit('close')"
        >
          ESC
        </Badge>
      </div>

      <!-- Search Results List -->
      <div class="max-h-80 overflow-y-auto p-2">
        <div v-if="loading" class="flex items-center justify-center py-10 text-xs gap-2">
          <Loader2 class="w-4 h-4 animate-spin text-emerald-400" />
          <span>Searching tokens...</span>
        </div>

        <Empty
          v-else-if="filteredTokens.length === 0"
          title="No tokens found"
          :description="
            query ? `No matching tokens for '${query}'` : 'Type token name, ticker or 0x address'
          "
          class="border-0 bg-transparent py-6"
        />

        <ul v-else class="space-y-1">
          <li v-for="item in filteredTokens" :key="item.token.address">
            <button
              @click="selectToken(item.token.address)"
              class="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-800/60 transition text-left group cursor-pointer"
            >
              <div class="flex items-center gap-3 min-w-0">
                <Avatar class="w-8 h-8 rounded-lg border border-zinc-700 shrink-0">
                  <AvatarFallback class="bg-zinc-800 text-emerald-400 font-bold text-xs rounded-lg">
                    {{ item.token.symbol.slice(0, 3) }}
                  </AvatarFallback>
                </Avatar>

                <div class="truncate">
                  <div class="flex items-center gap-2">
                    <span
                      class="text-sm font-semibold group-hover:text-emerald-400 transition truncate"
                    >
                      {{ item.token.name }}
                    </span>
                    <span class="text-xs font-mono"> ${{ item.token.symbol }} </span>
                  </div>
                  <p class="text-[11px] font-mono truncate">
                    {{ item.token.address }}
                  </p>
                </div>
              </div>

              <div class="text-right shrink-0 font-mono text-xs ml-4">
                <span class="font-semibold block">${{ item.marketData.priceUsd.toFixed(8) }}</span>
                <span
                  :class="item.marketData.isGraduated ? 'text-emerald-400' : ''"
                  class="text-[10px]"
                >
                  {{
                    item.marketData.isGraduated
                      ? 'Graduated'
                      : `${(item.marketData.graduationProgress * 100).toFixed(0)}%`
                  }}
                </span>
              </div>
            </button>
          </li>
        </ul>
      </div>

      <!-- Quick Actions Footer -->
      <div
        class="px-4 py-2.5 bg-zinc-950/50 border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono"
      >
        <span
          >Navigate: <kbd class="bg-zinc-800 px-1 py-0.5 rounded text-[10px]">↑</kbd>
          <kbd class="bg-zinc-800 px-1 py-0.5 rounded text-[10px]">↓</kbd></span
        >
        <span>Select: <kbd class="bg-zinc-800 px-1 py-0.5 rounded text-[10px]">ENTER</kbd></span>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Search, Loader2 } from 'lucide-vue-next';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Empty } from '@/components/ui/empty';
import type { LaunchedTokenEntity, TokenMarketData } from '@proto/shared-types';

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
    const res = await fetch('http://localhost:3001/api/tokens');
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
