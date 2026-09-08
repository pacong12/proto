<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <Sparkles class="w-5 h-5 text-emerald-400" />
          <h1 class="text-3xl font-bold tracking-tight text-white">Explore Launches</h1>
        </div>
        <p class="text-zinc-400 text-sm mt-1">
          Fixed-supply tokens climbing toward graduation on Robinhood Chain.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <!-- Shadcn Combobox for sorting -->
        <Combobox
          v-model="activeFilter"
          :options="sortOptions"
          class="w-36"
          placeholder="Sort tokens"
        />

        <Button @click="$emit('selectTab', 'create')" variant="default" size="sm">
          <Plus class="w-4 h-4 mr-1.5" />
          Create Token
        </Button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <Loader2 class="w-6 h-6 text-emerald-400 animate-spin" />
      <span class="ml-3 text-sm text-zinc-400">Loading tokens...</span>
    </div>

    <!-- API Error State -->
    <div
      v-else-if="apiError"
      class="flex items-start gap-3 bg-amber-950/40 border border-amber-800 rounded-xl p-4 text-sm text-amber-300"
    >
      <AlertCircle class="w-5 h-5 shrink-0 mt-0.5" />
      <span>Unable to load tokens from the API. Please check that the backend is running.</span>
    </div>

    <!-- Shadcn Empty Component -->
    <Empty
      v-else-if="displayTokens.length === 0"
      title="No tokens launched yet"
      description="Be the first creator to deploy a fixed-supply token directly to locked Uniswap V3 liquidity."
    >
      <template #action>
        <Button @click="$emit('selectTab', 'create')" size="sm">
          <Plus class="w-3.5 h-3.5 mr-1" /> Launch First Token
        </Button>
      </template>
    </Empty>

    <!-- Token Grid -->
    <div v-else class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <Card
          v-for="item in paginatedTokens"
          :key="item.token.address"
          class="group hover:border-zinc-700 hover:-translate-y-0.5 transition-all flex flex-col justify-between p-5"
        >
          <div>
            <div class="flex items-start justify-between gap-3">
              <div
                @click="$emit('selectToken', item.token.address)"
                class="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
              >
                <!-- Shadcn Avatar -->
                <Avatar
                  class="w-12 h-12 rounded-xl border border-zinc-700 group-hover:border-emerald-500/50 transition"
                >
                  <AvatarFallback
                    class="bg-zinc-800 text-emerald-400 font-bold text-base rounded-xl"
                  >
                    {{ item.token.symbol.slice(0, 3) }}
                  </AvatarFallback>
                </Avatar>

                <div class="truncate">
                  <!-- Shadcn HoverCard for Token Inspection -->
                  <HoverCard>
                    <HoverCardTrigger as-child>
                      <h2
                        class="font-bold text-white text-base truncate hover:text-emerald-400 transition inline-block"
                      >
                        {{ item.token.name }}
                      </h2>
                    </HoverCardTrigger>
                    <HoverCardContent class="space-y-2 text-xs">
                      <div
                        class="flex items-center justify-between border-b border-zinc-800 pb-1.5"
                      >
                        <span class="font-semibold text-white"
                          >{{ item.token.name }} (${{ item.token.symbol }})</span
                        >
                        <Badge variant="outline" class="text-[10px]">ERC-20</Badge>
                      </div>
                      <div class="space-y-1 font-mono text-[11px] text-zinc-400">
                        <div class="flex justify-between">
                          <span>CA:</span>
                          <button
                            @click.stop="copyText(item.token.address)"
                            class="text-emerald-400 hover:underline inline-flex items-center gap-1"
                          >
                            <span
                              >{{ item.token.address.slice(0, 6) }}...{{
                                item.token.address.slice(-4)
                              }}</span
                            >
                            <Copy class="w-3 h-3" />
                          </button>
                        </div>
                        <div class="flex justify-between">
                          <span>Pool:</span>
                          <span class="text-zinc-300"
                            >{{ item.token.poolAddress.slice(0, 6) }}...{{
                              item.token.poolAddress.slice(-4)
                            }}</span
                          >
                        </div>
                        <div class="flex justify-between">
                          <span>Supply:</span>
                          <span class="text-zinc-300">1,000,000,000</span>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>

                  <p class="text-xs font-mono text-zinc-400">${{ item.token.symbol }}</p>
                </div>
              </div>

              <Badge
                v-if="item.marketData.isGraduated"
                variant="graduated"
                class="gap-1 text-[11px]"
              >
                <CheckCircle class="w-3 h-3" />
                Graduated
              </Badge>
            </div>

            <p
              @click="$emit('selectToken', item.token.address)"
              class="text-xs text-zinc-400 mt-3 line-clamp-2 leading-relaxed cursor-pointer"
            >
              {{ item.token.description || 'Fixed-supply token on Robinhood Chain.' }}
            </p>
          </div>

          <div
            @click="$emit('selectToken', item.token.address)"
            class="mt-5 space-y-3 pt-4 border-t border-zinc-800/80 cursor-pointer"
          >
            <div class="flex justify-between text-xs">
              <span class="text-zinc-400 flex items-center gap-1">
                <Coins class="w-3.5 h-3.5 text-zinc-500" />
                Market Cap
              </span>
              <span class="font-mono font-medium text-white">
                ${{ item.marketData.marketCapUsd.toLocaleString() }}
              </span>
            </div>
            <div class="flex justify-between text-xs">
              <span class="text-zinc-400 flex items-center gap-1">
                <Flame class="w-3.5 h-3.5 text-emerald-400" />
                Graduation (4.2 ETH)
              </span>
              <span class="font-mono font-medium text-emerald-400">
                {{ (item.marketData.graduationProgress * 100).toFixed(1) }}%
              </span>
            </div>

            <!-- Shadcn Progress -->
            <Progress :model-value="item.marketData.graduationProgress * 100" class="h-1.5" />
          </div>
        </Card>
      </div>

      <!-- Shadcn Pagination Component -->
      <Pagination
        v-if="displayTokens.length > pageSize"
        :total="displayTokens.length"
        :items-per-page="pageSize"
        :page="currentPage"
        @update:page="currentPage = $event"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  Sparkles,
  Plus,
  CheckCircle,
  Coins,
  Flame,
  Loader2,
  AlertCircle,
  Copy,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Combobox } from '@/components/ui/combobox';
import { Empty } from '@/components/ui/empty';
import { Pagination } from '@/components/ui/pagination';
import type { LaunchedTokenEntity, TokenMarketData } from '@proto/shared-types';

defineEmits<{
  (e: 'selectToken', address: string): void;
  (e: 'selectTab', tab: string): void;
}>();

const activeFilter = ref('recent');
const loading = ref(true);
const apiError = ref<string | null>(null);
const displayTokens = ref<Array<{ token: LaunchedTokenEntity; marketData: TokenMarketData }>>([]);

const currentPage = ref(1);
const pageSize = 6;

const sortOptions = [
  { label: 'Recent Buys', value: 'recent' },
  { label: 'Newest', value: 'newest' },
  { label: 'Market Cap', value: 'mcap' },
  { label: 'Volume', value: 'volume' },
];

const paginatedTokens = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return displayTokens.value.slice(start, start + pageSize);
});

function copyText(txt: string) {
  navigator.clipboard.writeText(txt);
}

onMounted(async () => {
  try {
    const res = await fetch('http://localhost:3001/api/tokens');
    const envelope = await res.json();
    if (envelope.success && Array.isArray(envelope.data)) {
      displayTokens.value = envelope.data;
    } else {
      apiError.value = envelope.error?.message || 'Unable to fetch tokens';
    }
  } catch (e) {
    apiError.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
});
</script>
