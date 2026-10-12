<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <Card
        v-for="item in paginatedTokens"
        :key="item.token.address"
        class="group hover:border-primary/60 transition-all p-5 cursor-pointer rounded-2xl bg-card border border-border flex flex-col justify-between shadow-xs hover:shadow-md space-y-4"
        @click="$emit('selectToken', item.token.address)"
      >
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="relative shrink-0">
                <OptimizedImage
                  :src="item.token.logo"
                  :alt="item.token.name"
                  :fallback-text="item.token.symbol"
                  :width="42"
                  :height="42"
                  class="rounded-full border border-border object-cover shrink-0 ring-1 ring-border group-hover:ring-primary/50 transition"
                />
                <img
                  :src="
                    tokenStore.getTokenNetwork(item.token.address).chainId === 5042
                      ? '/chains/arc.svg'
                      : '/chains/robinhood.svg'
                  "
                  :alt="tokenStore.getTokenNetwork(item.token.address).name"
                  :title="tokenStore.getTokenNetwork(item.token.address).name"
                  class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-black bg-black object-contain shadow-xs"
                />
              </div>
              <div class="truncate">
                <h3
                  class="font-bold text-sm text-foreground group-hover:text-primary transition truncate"
                >
                  {{ item.token.name }}
                </h3>
                <div class="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                  <span>${{ item.token.symbol }}</span>
                  <span>&middot;</span>
                  <span>{{ formatRelativeTime(item.token.createdAt) }}</span>
                  <template v-if="item.token.deployer">
                    <span>&middot;</span>
                    <button
                      type="button"
                      class="hover:text-foreground transition-colors hover:underline underline-offset-2 cursor-pointer truncate max-w-[120px]"
                      :title="`View profile: ${getUserIdentity(item.token.deployer).displayName}`"
                      @click.stop="navigateToDeployer(item.token.deployer)"
                    >
                      {{ getUserIdentity(item.token.deployer).displayName }}
                    </button>
                  </template>
                </div>
              </div>
            </div>

            <!-- Top-right: Pin Button + Price Change -->
            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                class="p-1 rounded-lg transition-transform hover:scale-110 cursor-pointer select-none"
                :class="
                  isPinned(item.token.address)
                    ? 'text-amber-400'
                    : 'text-muted-foreground/35 hover:text-amber-400'
                "
                :title="isPinned(item.token.address) ? 'Unpin coin' : 'Pin to Watchlist'"
                @click.stop="$emit('togglePin', item.token.address)"
              >
                <Star
                  class="w-4 h-4"
                  :class="isPinned(item.token.address) ? 'fill-amber-400 text-amber-400' : ''"
                />
              </button>
              <span
                class="text-xs font-mono font-bold"
                :class="
                  (item.marketData?.priceChange24h ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                "
              >
                {{ (item.marketData?.priceChange24h ?? 0) >= 0 ? '+' : ''
                }}{{ (item.marketData?.priceChange24h ?? 0).toFixed(2) }}%
              </span>
            </div>
          </div>

          <!-- Price & MCap -->
          <div class="grid grid-cols-2 gap-2 pt-2 border-t border-border font-mono text-xs">
            <div>
              <span class="text-[10px] text-muted-foreground block">MARKET CAP</span>
              <span class="font-bold text-sm text-foreground">
                ${{ formatNumberCap(item.marketData?.marketCapUsd ?? 4200) }}
              </span>
            </div>
            <div class="text-right">
              <span class="text-[10px] text-muted-foreground block">VOLUME 24H</span>
              <span class="font-semibold text-muted-foreground">
                {{
                  (item.marketData?.volume24hUsd ?? 0) > 0
                    ? formatCompactUsd(item.marketData?.volume24hUsd)
                    : '—'
                }}
              </span>
            </div>
          </div>

          <!-- Bonding Progress -->
          <div class="space-y-1 pt-1">
            <div class="flex justify-between text-[10px] font-mono">
              <span class="text-muted-foreground">Bonding Curve</span>
              <span class="font-bold text-emerald-500">
                {{ ((item.marketData?.graduationProgress ?? 0) * 100).toFixed(1) }}%
              </span>
            </div>
            <Progress
              :model-value="(item.marketData?.graduationProgress ?? 0) * 100"
              class="h-1.5 rounded-full"
            />
          </div>
        </div>
      </Card>
    </div>

    <!-- Pagination in Grid View -->
    <div v-if="totalItems > pageSize" class="flex justify-center pt-4">
      <Pagination
        :current-page="currentPage"
        :total-items="totalItems"
        :page-size="pageSize"
        @update:current-page="$emit('update:currentPage', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Star } from 'lucide-vue-next';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Pagination } from '@/components/ui/pagination';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { formatRelativeTime, formatCompactUsd } from '@/lib/utils';
import { getUserIdentity } from '@/lib/username';
import { useTokenStore } from '@/composables/useTokenStore';
import type { LaunchedTokenEntity, TokenMarketData } from '@proto/shared-types';

interface TokenItem {
  token: LaunchedTokenEntity;
  marketData?: TokenMarketData | null;
}

interface Props {
  paginatedTokens: TokenItem[];
  totalItems: number;
  currentPage: number;
  pageSize: number;
  isPinned: (address: string) => boolean;
}

defineProps<Props>();

defineEmits<{
  (e: 'selectToken', address: string): void;
  (e: 'togglePin', address: string): void;
  (e: 'update:currentPage', page: number): void;
}>();

const router = useRouter();
const tokenStore = useTokenStore();

function navigateToDeployer(deployerAddress: string) {
  if (!deployerAddress) return;
  router.push(`/${getUserIdentity(deployerAddress).name}`);
}

function formatNumberCap(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(0);
}
</script>
