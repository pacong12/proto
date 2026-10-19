<template>
  <div class="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
    <Table class="text-sm min-w-[920px]">
      <TableHeader>
        <TableRow
          class="border-b border-border text-muted-foreground uppercase tracking-wider text-xs"
        >
          <TableHead
            class="py-3 px-3 xl:px-4 font-semibold whitespace-nowrap sticky left-0 z-20 bg-card text-muted-foreground"
          >
            {{ t('tokenCol').toUpperCase() }}
          </TableHead>
          <TableHead
            class="py-3 px-3 xl:px-4 font-semibold whitespace-nowrap text-center w-24 text-muted-foreground hidden xl:table-cell"
            >GRAPH</TableHead
          >
          <TableHead
            class="py-3 px-3 xl:px-4 font-semibold whitespace-nowrap text-right text-muted-foreground"
            >{{ t('marketCapCol').toUpperCase() }}</TableHead
          >
          <TableHead
            class="py-3 px-3 xl:px-4 font-semibold whitespace-nowrap text-center w-36 text-muted-foreground"
            >{{ t('progress').toUpperCase() }}</TableHead
          >
          <TableHead
            class="py-3 px-3 xl:px-4 font-semibold whitespace-nowrap text-right text-muted-foreground"
            >{{ t('timeCol').toUpperCase() }}</TableHead
          >
          <TableHead
            class="py-3 px-3 xl:px-4 font-semibold whitespace-nowrap text-right text-muted-foreground"
            >{{ t('volume24hCol').toUpperCase() }}</TableHead
          >
          <TableHead
            class="py-3 px-3 xl:px-4 font-semibold whitespace-nowrap text-right text-muted-foreground"
            >{{ t('change24hCol').toUpperCase() }}</TableHead
          >
          <TableHead
            class="py-3 px-3 xl:px-4 font-semibold whitespace-nowrap text-right text-muted-foreground"
            >{{ t('actionCol').toUpperCase() }}</TableHead
          >
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="item in paginatedTokens"
          :key="item.token.address"
          class="hover:bg-muted/50 transition-colors cursor-pointer group"
          @click="$emit('selectToken', item.token.address)"
        >
          <!-- 1. COIN (Pin + Logo + Name + Symbol + Creator + Copy Contract) -->
          <TableCell
            class="py-3.5 px-3 xl:px-4 sticky left-0 z-10 bg-card group-hover:bg-muted/50 transition-colors w-[18rem] max-w-[18rem] xl:w-[22rem] xl:max-w-[22rem]"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <!-- Pons-style Pin / Star Button -->
              <button
                type="button"
                class="min-w-6 min-h-6 inline-flex items-center justify-center p-1 rounded-lg transition-transform hover:scale-110 cursor-pointer select-none shrink-0"
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

              <div class="relative shrink-0">
                <OptimizedImage
                  :src="item.token.logo"
                  :alt="item.token.name"
                  :fallback-text="item.token.symbol"
                  :width="36"
                  :height="36"
                  class="rounded-lg border border-border object-cover shrink-0 ring-1 ring-border group-hover:ring-primary/50 transition"
                />
                <img
                  :src="getChainIcon(tokenStore.getTokenNetwork(item.token.address))"
                  :alt="tokenStore.getTokenNetwork(item.token.address).name"
                  :title="tokenStore.getTokenNetwork(item.token.address).name"
                  class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border border-black bg-black object-contain shadow-xs"
                />
              </div>

              <div class="min-w-0 flex-1">
                <!-- Line 1: name, ticker, tax, holder dividends -->
                <div class="flex items-center gap-1.5 min-w-0">
                  <span
                    class="font-bold text-sm text-foreground group-hover:text-primary transition truncate min-w-0"
                  >
                    {{ item.token.name }}
                  </span>
                  <span class="font-bold text-xs text-muted-foreground shrink-0"
                    >${{ item.token.symbol }}</span
                  >
                  <TaxTooltip
                    :buy-tax-bps="item.token.taxConfig?.buyTaxBps"
                    :sell-tax-bps="item.token.taxConfig?.sellTaxBps"
                    custom-class="text-xs shrink-0"
                  />
                  <span
                    v-if="(item.token.taxConfig?.revenueSplit?.holders ?? 0) > 0"
                    class="text-xs text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/20 bg-sky-500/5 shrink-0 whitespace-nowrap"
                    title="Holder Fee Sharing Enabled"
                  >
                    {{ item.token.taxConfig?.revenueSplit?.holders }}% Divs
                  </span>
                </div>
                <!-- Line 2: contract address, creator -->
                <div class="flex items-center gap-2 mt-0.5 min-w-0">
                  <button
                    type="button"
                    class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 bg-muted/40 hover:bg-muted border border-border px-1.5 py-0.5 rounded transition cursor-pointer shrink-0"
                    title="Copy Contract Address"
                    @click.stop="copyAddress(item.token.address)"
                  >
                    <span>{{ shortenAddress(item.token.address, 4, 3) }}</span>
                    <Check
                      v-if="copiedAddress === item.token.address"
                      class="w-3 h-3 text-emerald-500"
                    />
                    <Copy v-else class="w-3 h-3" />
                  </button>
                  <button
                    v-if="item.token.deployer"
                    type="button"
                    class="text-xs text-muted-foreground hover:text-foreground truncate min-w-0 cursor-pointer transition-colors hover:underline underline-offset-2"
                    :title="`View profile: ${getUserIdentity(item.token.deployer).displayName}`"
                    @click.stop="navigateToDeployer(item.token.deployer)"
                  >
                    by {{ getUserIdentity(item.token.deployer).displayName }}
                  </button>
                </div>
              </div>
            </div>
          </TableCell>

          <!-- 3. GRAPH (Mini SVG Sparkline curve) -->
          <TableCell class="py-3.5 px-3 xl:px-4 text-center hidden xl:table-cell">
            <svg
              class="inline-block overflow-visible"
              width="72"
              height="24"
              viewBox="0 0 72 24"
              fill="none"
            >
              <path
                :d="getSparkline(item.marketData?.priceChange24h ?? 0, 72, 24).d"
                :stroke="getSparkline(item.marketData?.priceChange24h ?? 0, 72, 24).color"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </TableCell>

          <!-- 4. MARKET CAP -->
          <TableCell class="py-3.5 px-3 xl:px-4 text-right font-extrabold text-sm text-foreground">
            {{
              (item.marketData?.marketCapUsd ?? 0) > 0
                ? `$${formatNumberCap(item.marketData?.marketCapUsd ?? 0)}`
                : '—'
            }}
          </TableCell>

          <!-- 5. BONDING / PROGRESS -->
          <TableCell class="py-3.5 px-3 xl:px-4">
            <div class="space-y-1.5 max-w-[130px] mx-auto text-center">
              <div class="flex items-center justify-between gap-2 text-xs whitespace-nowrap">
                <span class="text-muted-foreground">
                  {{ item.marketData?.isGraduated ? t('graduated') : t('onCurve') }}
                </span>
                <span class="font-bold text-emerald-500">
                  {{ ((item.marketData?.graduationProgress ?? 0) * 100).toFixed(0) }}%
                </span>
              </div>
              <Progress
                :model-value="(item.marketData?.graduationProgress ?? 0) * 100"
                class="h-1.5 rounded-full"
              />
            </div>
          </TableCell>

          <!-- 6. AGE -->
          <TableCell
            class="py-3.5 px-3 xl:px-4 text-right text-muted-foreground font-semibold text-xs whitespace-nowrap"
          >
            {{ formatRelativeTime(item.token.createdAt) }}
          </TableCell>

          <!-- 7. VOLUME 24H -->
          <TableCell
            class="py-3.5 px-3 xl:px-4 text-right text-muted-foreground font-semibold text-xs"
          >
            {{
              (item.marketData?.volume24hUsd ?? 0) > 0
                ? formatCompactUsd(item.marketData?.volume24hUsd)
                : '—'
            }}
          </TableCell>

          <!-- 8. 24H % -->
          <TableCell
            class="py-3.5 px-3 xl:px-4 text-right font-extrabold text-xs"
            :class="
              (item.marketData?.priceChange24h ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
            "
          >
            {{ (item.marketData?.priceChange24h ?? 0) >= 0 ? '+' : ''
            }}{{ (item.marketData?.priceChange24h ?? 0).toFixed(2) }}%
          </TableCell>

          <!-- 9. ACTION (Quick Buy / Trade button) -->
          <TableCell class="py-3.5 px-3 xl:px-4 text-right">
            <Button
              size="sm"
              variant="outline"
              class="h-8 px-3 text-xs font-bold rounded-xl border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all cursor-pointer inline-flex items-center gap-1"
              @click.stop="$emit('selectToken', item.token.address)"
            >
              <span>{{ t('trade') }}</span>
              <ArrowRight class="w-3.5 h-3.5" />
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>

    <!-- Pagination in Table Footer -->
    <div
      v-if="totalItems > pageSize"
      class="flex justify-center p-4 border-t border-border bg-card"
    >
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
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Star, Copy, Check, ArrowRight } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Pagination } from '@/components/ui/pagination';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import TaxTooltip from '@/components/ui/TaxTooltip.vue';
import { shortenAddress, formatRelativeTime, formatCompactUsd, getChainIcon } from '@/lib/utils';
import { getUserIdentity } from '@/lib/username';
import { useTokenStore } from '@/composables/useTokenStore';
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

withDefaults(defineProps<Props>(), {
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
const copiedAddress = ref<string | null>(null);

function copyAddress(address: string) {
  if (typeof navigator !== 'undefined') {
    navigator.clipboard.writeText(address);
    copiedAddress.value = address;
    setTimeout(() => {
      if (copiedAddress.value === address) copiedAddress.value = null;
    }, 2000);
  }
}

function navigateToDeployer(deployerAddress: string) {
  if (!deployerAddress) return;
  router.push(`/${getUserIdentity(deployerAddress).name}`);
}

function formatNumberCap(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(0);
}

function getSparkline(change: number, width = 72, height = 24) {
  const isUp = change >= 0;
  const color = isUp ? '#22c55e' : '#ef4444';
  const startY = isUp ? height - 4 : 4;
  const endY = isUp ? 4 : height - 4;
  const controlY = height / 2;
  const d = `M 0 ${startY} Q ${width / 2} ${controlY} ${width} ${endY}`;
  return { d, color };
}
</script>
