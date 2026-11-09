<template>
  <div>
    <Table bare class="text-sm min-w-[720px]">
      <TableHeader>
        <TableRow class="border-b border-border hover:bg-transparent [&_th]:whitespace-nowrap">
          <TableHead
            class="py-2.5 pl-2 pr-3 text-xs font-medium text-muted-foreground sticky left-0 z-20 bg-background tracking-normal h-auto"
          >
            {{ t('tokenCol') }}
          </TableHead>
          <TableHead
            title="Price since launch"
            class="py-2.5 px-3 text-xs font-medium text-muted-foreground text-right hidden lg:table-cell tracking-normal h-auto bg-transparent"
          >
            Graph
          </TableHead>
          <TableHead
            class="py-2.5 px-3 text-xs font-medium text-muted-foreground text-right tracking-normal h-auto bg-transparent"
          >
            {{ t('marketCapCol') }}
          </TableHead>
          <TableHead
            v-if="showProgress"
            class="py-2.5 px-3 text-xs font-medium text-muted-foreground text-center tracking-normal h-auto bg-transparent"
          >
            {{ t('progress') }}
          </TableHead>
          <TableHead
            class="py-2.5 px-3 text-xs font-medium text-muted-foreground text-right hidden md:table-cell tracking-normal h-auto bg-transparent"
          >
            {{ t('volume24hCol') }}
          </TableHead>
          <TableHead
            class="py-2.5 pl-3 pr-2 text-xs font-medium text-muted-foreground text-right tracking-normal h-auto bg-transparent"
          >
            {{ t('change24hCol') }}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="item in paginatedTokens"
          :key="item.token.address"
          class="border-b border-border/60 hover:bg-muted/40 transition-colors cursor-pointer group"
          @click="$emit('selectToken', item.token.address)"
        >
          <!-- Token: pin, logo with chain, name and ticker; creator, age, tax and dividends below -->
          <TableCell
            class="py-3 pl-2 pr-3 sticky left-0 z-10 bg-background group-hover:bg-muted/40 transition-colors w-[22rem] max-w-[22rem]"
          >
            <div class="flex items-center gap-3 min-w-0">
              <button
                type="button"
                class="w-6 h-6 -mr-1 inline-flex items-center justify-center rounded-md cursor-pointer select-none shrink-0 transition-colors"
                :class="
                  isPinned(item.token.address)
                    ? 'text-amber-400'
                    : 'text-muted-foreground/30 hover:text-amber-400'
                "
                :title="isPinned(item.token.address) ? 'Unpin coin' : 'Pin to Watchlist'"
                :aria-label="isPinned(item.token.address) ? 'Unpin coin' : 'Pin to Watchlist'"
                @click.stop="$emit('togglePin', item.token.address)"
              >
                <Star
                  class="w-3.5 h-3.5"
                  :class="isPinned(item.token.address) ? 'fill-amber-400' : ''"
                />
              </button>

              <div class="relative shrink-0">
                <OptimizedImage
                  :src="item.token.logo"
                  :alt="item.token.name"
                  :fallback-text="item.token.symbol"
                  :width="40"
                  :height="40"
                  class="rounded-xl border border-border object-cover shrink-0"
                />
                <img
                  :src="getChainIcon(tokenStore.getTokenNetwork(item.token))"
                  :alt="tokenStore.getTokenNetwork(item.token).name"
                  :title="tokenStore.getTokenNetwork(item.token).name"
                  class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background bg-background object-contain"
                />
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-baseline gap-1.5 min-w-0">
                  <span
                    class="font-semibold text-[15px] text-foreground truncate min-w-0 group-hover:underline underline-offset-2"
                  >
                    {{ item.token.name }}
                  </span>
                  <span class="text-xs text-muted-foreground shrink-0">{{
                    item.token.symbol
                  }}</span>
                </div>
                <div class="flex items-center gap-1.5 mt-0.5 min-w-0 text-xs text-muted-foreground">
                  <button
                    v-if="item.token.deployer"
                    type="button"
                    class="truncate min-w-0 cursor-pointer hover:text-foreground transition-colors"
                    :title="`View profile: ${getUserIdentity(item.token.deployer).displayName}`"
                    @click.stop="navigateToDeployer(item.token.deployer)"
                  >
                    {{ getUserIdentity(item.token.deployer).displayName }}
                  </button>
                  <span class="shrink-0 whitespace-nowrap">{{
                    formatRelativeTime(item.token.createdAt)
                  }}</span>
                  <TaxTooltip
                    :buy-tax-bps="item.token.taxConfig?.buyTaxBps"
                    :sell-tax-bps="item.token.taxConfig?.sellTaxBps"
                    custom-class="text-xs shrink-0"
                  />
                  <span
                    v-if="(item.token.taxConfig?.revenueSplit?.holders ?? 0) > 0"
                    class="text-sky-500 shrink-0 whitespace-nowrap"
                    title="Holder Fee Sharing Enabled"
                  >
                    {{ item.token.taxConfig?.revenueSplit?.holders }}% Divs
                  </span>
                </div>
              </div>
            </div>
          </TableCell>

          <!-- Graph: price since launch -->
          <TableCell class="py-3 px-3 text-right hidden lg:table-cell">
            <svg
              class="inline-block overflow-visible"
              width="96"
              height="28"
              viewBox="0 0 72 24"
              preserveAspectRatio="none"
              fill="none"
            >
              <path
                :d="spark(item.token.address).d"
                :stroke="TREND_COLOR[spark(item.token.address).trend]"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                vector-effect="non-scaling-stroke"
              />
            </svg>
          </TableCell>

          <TableCell class="py-3 px-3 text-right font-semibold text-foreground tabular-nums">
            {{
              (item.marketData?.marketCapUsd ?? 0) > 0
                ? `$${formatNumberCap(item.marketData?.marketCapUsd ?? 0)}`
                : '—'
            }}
          </TableCell>

          <!-- Progress: only bonding-curve launches have one; an in-pool launch trades from block one. -->
          <TableCell v-if="showProgress" class="py-3 px-3">
            <div
              v-if="!hasCurve(item)"
              class="text-center text-xs text-muted-foreground whitespace-nowrap"
              :title="item.token.version === 'v4' ? t('inPoolLiveHint') : undefined"
            >
              {{ item.token.version === 'v4' ? t('livePool') : t('graduated') }}
            </div>
            <div v-else class="space-y-1 w-28 mx-auto">
              <div class="flex justify-between text-xs tabular-nums">
                <span class="text-muted-foreground">{{ t('onCurve') }}</span>
                <span class="font-semibold text-foreground">
                  {{ ((item.marketData?.graduationProgress ?? 0) * 100).toFixed(0) }}%
                </span>
              </div>
              <Progress
                :model-value="(item.marketData?.graduationProgress ?? 0) * 100"
                class="h-1 rounded-full"
              />
            </div>
          </TableCell>

          <TableCell
            class="py-3 px-3 text-right text-muted-foreground tabular-nums hidden md:table-cell"
          >
            {{
              (item.marketData?.volume24hUsd ?? 0) > 0
                ? formatCompactUsd(item.marketData?.volume24hUsd)
                : '—'
            }}
          </TableCell>

          <TableCell
            class="py-3 pl-3 pr-2 text-right font-medium tabular-nums"
            :class="
              (item.marketData?.priceChange24h ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
            "
          >
            {{ (item.marketData?.priceChange24h ?? 0) >= 0 ? '+' : ''
            }}{{ (item.marketData?.priceChange24h ?? 0).toFixed(2) }}%
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>

    <div v-if="totalItems > pageSize" class="flex justify-center pt-5">
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
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Star } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Pagination } from '@/components/ui/pagination';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import TaxTooltip from '@/components/ui/TaxTooltip.vue';
import { formatRelativeTime, formatCompactUsd, getChainIcon } from '@/lib/utils';
import { getUserIdentity } from '@/lib/username';
import { useTokenStore } from '@/composables/useTokenStore';
import { useWallet } from '@/composables/useWallet';
import { apiFetch } from '@/lib/api-client';
import { sparklinePath, type SparkTrend } from '@/lib/sparkline';
import type { LaunchedTokenEntity, TokenMarketData } from '@goton/shared-types';

interface TokenItem {
  token: LaunchedTokenEntity;
  marketData?: TokenMarketData | null;
}

interface Props {
  paginatedTokens: TokenItem[];
  totalItems: number;
  currentPage: number;
  pageSize: number;
  currencySymbol?: string;
  isPinned: (address: string) => boolean;
}

const props = withDefaults(defineProps<Props>(), {
  currencySymbol: 'ETH',
});

const { t } = useI18n();

defineEmits<{
  (e: 'selectToken', address: string): void;
  (e: 'togglePin', address: string): void;
  (e: 'update:currentPage', page: number): void;
}>();

const router = useRouter();
const tokenStore = useTokenStore();
const { activeNetwork } = useWallet();

// Sparklines: each token's price from launch to now (GET /api/sparklines), for the active chain.
const TREND_COLOR: Record<SparkTrend, string> = {
  up: '#22c55e',
  down: '#ef4444',
  flat: '#71717a',
};
const sparklines = ref<Record<string, number[]>>({});
async function loadSparklines() {
  try {
    const res = await apiFetch<{ success: boolean; data: Record<string, number[]> }>(
      `/api/sparklines?chainId=${activeNetwork.value.chainId}`,
    );
    if (res.success) sparklines.value = res.data;
  } catch {
    // Leave the level placeholder lines.
  }
}
function spark(address: string) {
  return sparklinePath(sparklines.value[address.toLowerCase()], 72, 24);
}
onMounted(loadSparklines);
watch(() => activeNetwork.value.chainId, loadSparklines);
/** A bonding-curve launch still filling its curve: the only kind with progress to show. */
function hasCurve(item: TokenItem): boolean {
  return item.token.version !== 'v4' && !item.marketData?.isGraduated && !item.token.isGraduated;
}
/** The progress column only earns its room when a listed coin is still on its curve. */
const showProgress = computed(() => props.paginatedTokens.some(hasCurve));

function navigateToDeployer(deployerAddress: string) {
  if (!deployerAddress) return;
  router.push(`/${getUserIdentity(deployerAddress).slug}`);
}

function formatNumberCap(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(0);
}
</script>
