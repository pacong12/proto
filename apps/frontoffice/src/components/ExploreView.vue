<template>
  <div class="space-y-7 max-w-7xl mx-auto">
    <!-- ============================================================
         1. UBI.FUN-STYLE LATEST LAUNCHES / NEW ON NETWORK
         ============================================================ -->
    <div v-if="latestLaunches.length > 0" class="space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xs uppercase tracking-widest font-mono font-bold text-muted-foreground flex items-center gap-2">
            <span>New on {{ activeNetwork.name }}</span>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary border border-primary/20">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {{ activeNetwork.nativeCurrency.symbol }}
            </span>
          </h2>
          <p class="text-xs text-muted-foreground/80 mt-0.5">Latest launches</p>
        </div>
        <div class="flex items-center gap-2">
          <Button
            @click="$emit('selectTab', 'create')"
            size="sm"
            variant="default"
            class="h-7 text-xs font-bold gap-1 rounded-lg cursor-pointer"
          >
            <Plus class="w-3.5 h-3.5 stroke-[3]" />
            <span>{{ t('create') }}</span>
          </Button>
        </div>
      </div>

      <!-- Horizontal Cards Grid (ubi.fun style) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          v-for="item in latestLaunches"
          :key="item.token.address"
          @click="$emit('selectToken', item.token.address)"
          class="p-3.5 rounded-2xl bg-card border border-border hover:border-primary/60 transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-xs hover:shadow-md"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              class="p-1 -ml-1 rounded-lg transition-transform hover:scale-110 cursor-pointer select-none shrink-0"
              :class="isPinned(item.token.address) ? 'text-amber-400' : 'text-muted-foreground/35 hover:text-amber-400'"
              :title="isPinned(item.token.address) ? 'Unpin coin' : 'Pin to Watchlist'"
              @click.stop="togglePin(item.token.address)"
            >
              <Star
                class="w-3.5 h-3.5"
                :class="isPinned(item.token.address) ? 'fill-amber-400 text-amber-400' : ''"
              />
            </button>
            <OptimizedImage
              :src="item.token.logo"
              :alt="item.token.name"
              :fallback-text="item.token.symbol"
              :width="38"
              :height="38"
              class="rounded-full border border-border object-cover shrink-0 ring-1 ring-border group-hover:ring-primary/40 transition"
            />
            <div class="min-w-0 truncate">
              <h4
                class="font-bold text-xs sm:text-sm text-foreground truncate group-hover:text-primary transition"
              >
                {{ item.token.name }}
              </h4>
              <p class="text-[11px] font-mono font-semibold text-muted-foreground truncate">
                ${{ item.token.symbol }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <span
              class="text-[11px] font-mono font-semibold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md"
            >
              {{ formatRelativeTime(item.token.createdAt) }}
            </span>
            <div
              class="w-7 h-7 rounded-full bg-muted/70 group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center transition-colors text-muted-foreground"
            >
              <ArrowRight class="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================
         2. PROTOCOL HIGHLIGHTS HERO STRIP (ubi.fun style)
         ============================================================ -->
    <div
      class="p-5 sm:p-6 rounded-3xl bg-card border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-xs"
    >
      <div class="space-y-1.5 max-w-xl">
        <h1 class="text-xl sm:text-2xl font-black tracking-tight text-foreground">
          The launch floor for {{ activeNetwork.name }}.
        </h1>
        <p class="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Launch a coin with locked liquidity. Find your community. Every trade shares fees in
          {{ activeNetwork.nativeCurrency.symbol }}.
        </p>
      </div>

      <div
        class="grid grid-cols-2 sm:flex sm:items-center gap-4 sm:gap-6 font-mono text-xs w-full md:w-auto"
      >
        <div class="p-3 sm:p-0 rounded-xl bg-muted/40 sm:bg-transparent">
          <span
            class="text-muted-foreground text-[10px] uppercase tracking-wider block font-semibold"
          >
            24h Volume
          </span>
          <span class="font-extrabold text-sm sm:text-base text-foreground">
            ${{ totalVolume24hUsd.toLocaleString(undefined, { maximumFractionDigits: 0 }) }}
          </span>
        </div>
        <div class="p-3 sm:p-0 rounded-xl bg-muted/40 sm:bg-transparent">
          <span
            class="text-muted-foreground text-[10px] uppercase tracking-wider block font-semibold"
          >
            Total Coins
          </span>
          <span class="font-extrabold text-sm sm:text-base text-foreground">
            {{ totalTokensCount }}
          </span>
        </div>
        <div class="p-3 sm:p-0 rounded-xl bg-muted/40 sm:bg-transparent col-span-2 sm:col-span-1">
          <span
            class="text-muted-foreground text-[10px] uppercase tracking-wider block font-semibold"
          >
            Chain Standard
          </span>
          <span class="font-bold text-xs text-foreground">
            {{ activeNetwork.nativeCurrency.symbol }} Native Gas
          </span>
        </div>
      </div>
    </div>

    <!-- ============================================================
         3. EXPLORE COINS / MARKETS FILTER HEADER
         ============================================================ -->
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-bold tracking-tight text-foreground">Explore coins</h2>
          <p class="text-xs font-mono text-muted-foreground">
            Markets in {{ activeNetwork.nativeCurrency.symbol }}
          </p>
        </div>

        <!-- Right Controls: View Mode Switcher (Pons-Style Pills) -->
        <div class="flex items-center gap-2 self-end sm:self-auto font-mono">
          <div class="inline-flex items-center p-1 bg-muted/40 rounded-full border border-border gap-1">
            <button
              type="button"
              @click="viewMode = 'table'"
              class="px-3 py-1 text-xs font-semibold rounded-full transition cursor-pointer flex items-center gap-1.5"
              :class="
                viewMode === 'table'
                  ? 'bg-card text-foreground shadow-xs border border-border/80 font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              "
            >
              <List class="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              type="button"
              @click="viewMode = 'grid'"
              class="px-3 py-1 text-xs font-semibold rounded-full transition cursor-pointer flex items-center gap-1.5"
              :class="
                viewMode === 'grid'
                  ? 'bg-card text-foreground shadow-xs border border-border/80 font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              "
            >
              <LayoutGrid class="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Navigation Filter Pills (Shadcn Tabs variant="line") + Search Bar -->
      <div
        class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-border font-mono text-xs"
      >
        <!-- Filter Tabs -->
        <Tabs v-model="activeMarketTab" class="w-full md:w-auto">
          <TabsList variant="line" class="overflow-x-auto no-scrollbar gap-4 sm:gap-6 border-b-0 w-auto">
            <TabsTrigger
              v-for="tab in marketTabs"
              :key="tab.value"
              :value="tab.value"
            >
              {{ tab.label }}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <!-- Search Bar -->
        <div class="relative w-full md:w-64 shrink-0">
          <Search class="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
          <Input
            v-model="searchQuery"
            type="text"
            placeholder="Search coins / address..."
            class="h-8 pl-8 pr-3 text-xs bg-card border-border rounded-xl font-mono text-foreground focus-visible:ring-foreground"
          />
        </div>
      </div>
    </div>

    <!-- Error Banner -->
    <div
      v-if="apiError"
      class="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-center gap-2 font-mono"
    >
      <AlertCircle class="w-4 h-4 shrink-0" />
      <span>{{ apiError }}</span>
    </div>

    <!-- Loading State -->
    <div
      v-if="loading && allTokens.length === 0"
      class="flex flex-col items-center justify-center py-24 space-y-3"
    >
      <Loader2 class="w-7 h-7 text-emerald-500 animate-spin" />
      <span class="text-xs font-medium text-muted-foreground font-mono">
        Loading coins on {{ activeNetwork.name }}...
      </span>
    </div>

    <!-- ============================================================
         4A. SHADCN UI TABLE VIEW (https://ui.shadcn.com/docs/components/radix/table)
         ============================================================ -->
    <div
      v-else-if="viewMode === 'table' && filteredTokens.length > 0"
      class="rounded-2xl border border-border bg-black overflow-hidden shadow-xs"
    >
      <Table class="text-xs font-mono min-w-[920px] bg-black">
        <TableHeader>
          <TableRow class="border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] bg-black hover:bg-black">
            <TableHead class="py-3 px-4 font-semibold sticky left-0 z-20 bg-black text-muted-foreground">
              COIN
            </TableHead>
            <TableHead class="py-3 px-3 font-semibold text-center w-20 text-muted-foreground bg-black">PAIR</TableHead>
            <TableHead class="py-3 px-4 font-semibold text-center w-24 text-muted-foreground bg-black">GRAPH</TableHead>
            <TableHead class="py-3 px-4 font-semibold text-right text-muted-foreground bg-black">MARKET CAP</TableHead>
            <TableHead class="py-3 px-4 font-semibold text-center w-36 text-muted-foreground bg-black">BONDING</TableHead>
            <TableHead class="py-3 px-4 font-semibold text-right text-muted-foreground bg-black">AGE</TableHead>
            <TableHead class="py-3 px-4 font-semibold text-right text-muted-foreground bg-black">VOLUME 24H</TableHead>
            <TableHead class="py-3 px-4 font-semibold text-right text-muted-foreground bg-black">24H</TableHead>
            <TableHead class="py-3 px-4 font-semibold text-right text-muted-foreground bg-black">ACTION</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="item in paginatedTokens"
            :key="item.token.address"
            class="hover:bg-zinc-900/40 transition-colors cursor-pointer group bg-black"
            @click="$emit('selectToken', item.token.address)"
          >
            <!-- 1. COIN (Pin + Logo + Name + Symbol + Creator + Copy Contract) -->
            <TableCell
              class="py-3.5 px-4 sticky left-0 z-10 bg-black group-hover:bg-zinc-900/40 transition-colors"
            >
              <div class="flex items-center gap-2.5">
                <!-- Pons-style Pin / Star Button -->
                <button
                  type="button"
                  class="p-1 rounded-lg transition-transform hover:scale-110 cursor-pointer select-none shrink-0"
                  :class="isPinned(item.token.address) ? 'text-amber-400' : 'text-muted-foreground/35 hover:text-amber-400'"
                  :title="isPinned(item.token.address) ? 'Unpin coin' : 'Pin to Watchlist'"
                  @click.stop="togglePin(item.token.address)"
                >
                  <Star
                    class="w-4 h-4"
                    :class="isPinned(item.token.address) ? 'fill-amber-400 text-amber-400' : ''"
                  />
                </button>

                <OptimizedImage
                  :src="item.token.logo"
                  :alt="item.token.name"
                  :fallback-text="item.token.symbol"
                  :width="36"
                  :height="36"
                  class="rounded-full border border-border object-cover shrink-0 ring-1 ring-border group-hover:ring-primary/50 transition"
                />

                <div class="min-w-0 truncate">
                  <div class="flex items-center gap-1.5 truncate">
                    <span
                      class="font-bold text-sm text-foreground group-hover:text-primary transition truncate"
                    >
                      {{ item.token.name }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="font-bold text-xs text-muted-foreground"
                      >${{ item.token.symbol }}</span
                    >
                    <span class="text-muted-foreground/50 text-[10px] hidden sm:inline">&middot;</span>
                    <span class="text-[10px] text-muted-foreground truncate hidden sm:inline">
                      by {{ shortenAddress(item.token.deployer, 4, 3) }}
                    </span>
                    <button
                      type="button"
                      class="text-[10px] text-muted-foreground hover:text-foreground font-mono flex items-center gap-1 bg-muted/60 px-1.5 py-0.5 rounded transition cursor-pointer"
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
                  </div>
                </div>
              </div>
            </TableCell>

            <!-- 2. PAIR (Native Currency Pair like Pons) -->
            <TableCell class="py-3.5 px-3 text-center">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border/70 bg-muted/30 text-[10px] font-mono font-bold text-muted-foreground">
                <img
                  :src="currencySymbol === 'USDC' ? '/tokens/usdc.svg' : '/tokens/eth.svg'"
                  alt=""
                  class="w-3 h-3 rounded-full object-contain"
                />
                {{ currencySymbol }}
              </span>
            </TableCell>

            <!-- 3. GRAPH (Mini SVG Sparkline curve) -->
            <TableCell class="py-3.5 px-4 text-center">
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
            <TableCell class="py-3.5 px-4 text-right font-extrabold text-sm text-foreground font-mono">
              {{
                (item.marketData?.marketCapUsd ?? 0) > 0
                  ? `$${formatNumberCap(item.marketData?.marketCapUsd ?? 0)}`
                  : '—'
              }}
            </TableCell>

            <!-- 5. BONDING / PROGRESS -->
            <TableCell class="py-3.5 px-4">
              <div class="space-y-1.5 max-w-[130px] mx-auto font-mono text-center">
                <div class="flex items-center justify-between text-[10px]">
                  <span class="text-muted-foreground">
                    {{ item.marketData?.isGraduated ? 'Graduated' : 'Curve' }}
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
            <TableCell class="py-3.5 px-4 text-right text-muted-foreground font-semibold text-xs">
              {{ formatRelativeTime(item.token.createdAt) }}
            </TableCell>

            <!-- 7. VOLUME 24H -->
            <TableCell class="py-3.5 px-4 text-right text-muted-foreground font-semibold text-xs">
              {{
                (item.marketData?.volume24hUsd ?? 0) > 0
                  ? formatCompactUsd(item.marketData?.volume24hUsd)
                  : '—'
              }}
            </TableCell>

            <!-- 8. 24H % -->
            <TableCell
              class="py-3.5 px-4 text-right font-extrabold text-xs"
              :class="
                (item.marketData?.priceChange24h ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
              "
            >
              {{ (item.marketData?.priceChange24h ?? 0) >= 0 ? '+' : ''
              }}{{ (item.marketData?.priceChange24h ?? 0).toFixed(2) }}%
            </TableCell>

            <!-- 9. ACTION (Quick Buy / Trade button) -->
            <TableCell class="py-3.5 px-4 text-right">
              <Button
                size="sm"
                variant="outline"
                class="h-8 px-3 text-xs font-bold rounded-xl border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all cursor-pointer inline-flex items-center gap-1 font-mono"
                @click.stop="$emit('selectToken', item.token.address)"
              >
                <span>Trade</span>
                <ArrowRight class="w-3.5 h-3.5" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- Pagination in Table Footer -->
      <div
        v-if="filteredTokens.length > pageSize"
        class="flex justify-center p-4 border-t border-border bg-muted/20"
      >
        <Pagination
          :current-page="currentPage"
          :total-items="filteredTokens.length"
          :page-size="pageSize"
          @update:current-page="currentPage = $event"
        />
      </div>
    </div>

    <!-- ============================================================
         4B. CARD GRID VIEW MODE
         ============================================================ -->
    <div v-else-if="viewMode === 'grid' && filteredTokens.length > 0" class="space-y-6">
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
                <OptimizedImage
                  :src="item.token.logo"
                  :alt="item.token.name"
                  :fallback-text="item.token.symbol"
                  :width="42"
                  :height="42"
                  class="rounded-full border border-border object-cover shrink-0 ring-1 ring-border group-hover:ring-primary/50 transition"
                />
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
                  </div>
                </div>
              </div>

              <!-- Top-right: Pin Button + Price Change -->
              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  class="p-1 rounded-lg transition-transform hover:scale-110 cursor-pointer select-none"
                  :class="isPinned(item.token.address) ? 'text-amber-400' : 'text-muted-foreground/35 hover:text-amber-400'"
                  :title="isPinned(item.token.address) ? 'Unpin coin' : 'Pin to Watchlist'"
                  @click.stop="togglePin(item.token.address)"
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
      <div v-if="filteredTokens.length > pageSize" class="flex justify-center pt-4">
        <Pagination
          :current-page="currentPage"
          :total-items="filteredTokens.length"
          :page-size="pageSize"
          @update:current-page="currentPage = $event"
        />
      </div>
    </div>

    <!-- Empty State -->
    <Empty
      v-else-if="filteredTokens.length === 0"
      title="No coins found"
      description="Be the first to launch a coin on this market!"
      class="border border-border rounded-2xl p-12 bg-card text-center"
    >
      <template #action>
        <Button
          @click="$emit('selectTab', 'create')"
          size="default"
          class="gap-1.5 font-bold rounded-xl cursor-pointer"
        >
          <Plus class="w-4 h-4 stroke-[3]" />
          Create a coin
        </Button>
      </template>
    </Empty>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  Plus,
  Loader2,
  AlertCircle,
  Search,
  List,
  LayoutGrid,
  ArrowRight,
  Copy,
  Check,
  Star,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { ARC_CHAIN } from '@proto/shared-types';
import { useI18n } from '@/lib/i18n';
import { useWallet } from '@/composables/useWallet';
import { useTokenStore } from '@/composables/useTokenStore';
import { shortenAddress, formatRelativeTime, formatCompactUsd } from '@/lib/utils';

const { t } = useI18n();
const { activeNetwork } = useWallet();

defineEmits<{
  (e: 'selectToken', address: string): void;
  (e: 'selectTab', tab: string): void;
}>();

const viewMode = ref<'table' | 'grid'>('table');
const activeMarketTab = ref<
  'trending' | 'newest' | 'curve' | 'top' | 'highvol' | 'gainers' | 'pinned'
>('trending');

// Watchlist Pin Feature (Pons style with localStorage persistence)
const pinnedTokens = ref<Set<string>>(new Set());

function loadPinnedTokens() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('proto_pinned_tokens');
    if (raw) {
      pinnedTokens.value = new Set(JSON.parse(raw));
    }
  } catch {}
}

function togglePin(address: string) {
  if (!address) return;
  const lower = address.toLowerCase();
  const next = new Set(pinnedTokens.value);
  if (next.has(lower)) {
    next.delete(lower);
  } else {
    next.add(lower);
  }
  pinnedTokens.value = next;
  try {
    localStorage.setItem('proto_pinned_tokens', JSON.stringify(Array.from(next)));
  } catch {}
}

function isPinned(address: string): boolean {
  return pinnedTokens.value.has(address.toLowerCase());
}

const marketTabs = computed(() => [
  { label: 'Trending', value: 'trending' as const },
  { label: 'New', value: 'newest' as const },
  { label: 'Fair launch', value: 'curve' as const },
  { label: 'Top', value: 'top' as const },
  { label: 'High vol', value: 'highvol' as const },
  { label: 'Movers', value: 'gainers' as const },
  { label: `Pinned (${pinnedTokens.value.size})`, value: 'pinned' as const },
]);

const currencySymbol = computed(() => activeNetwork.value.nativeCurrency.symbol);

const searchQuery = ref('');
const tokenStore = useTokenStore();
const allTokens = tokenStore.tokens;
const networkTokens = tokenStore.networkTokens;
const loading = tokenStore.loading;
const apiError = ref<string | null>(null);
const currentPage = ref(1);
const pageSize = 15;
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

function formatNumberCap(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(0);
}

// Mini SVG Sparkline Generator (Strictly real trend slope)
function getSparkline(change = 0, width = 72, height = 24) {
  if (change === 0) {
    const midY = height / 2;
    return {
      d: `M 2 ${midY} L ${width - 2} ${midY}`,
      isUp: true,
      color: 'var(--muted-foreground)',
    };
  }
  const isUp = change > 0;
  const startY = isUp ? height * 0.75 : height * 0.25;
  const endY = isUp ? height * 0.25 : height * 0.75;
  const count = 5;
  const points = [];

  for (let i = 0; i < count; i++) {
    const x = (i / (count - 1)) * (width - 4) + 2;
    const progress = i / (count - 1);
    const y = startY + (endY - startY) * progress;
    points.push({
      x: Number(x.toFixed(1)),
      y: Number(Math.max(2, Math.min(height - 2, y)).toFixed(1)),
    });
  }

  const d = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  return { d, isUp, color: isUp ? 'var(--bullish)' : 'var(--bearish)' };
}

// Top 4 Latest Launches
const latestLaunches = computed(() => {
  return [...networkTokens.value].sort((a, b) => b.token.createdAt - a.token.createdAt).slice(0, 4);
});

const totalTokensCount = computed(() => networkTokens.value.length);
const totalVolume24hUsd = computed(() => {
  return networkTokens.value.reduce((acc, curr) => acc + (curr.marketData?.volume24hUsd || 0), 0);
});

// Main Filtered & Sorted Tokens
const filteredTokens = computed(() => {
  let list = [...networkTokens.value];

  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (item) =>
        item.token.name.toLowerCase().includes(q) ||
        item.token.symbol.toLowerCase().includes(q) ||
        item.token.address.toLowerCase().includes(q),
    );
  }

  if (activeMarketTab.value === 'pinned') {
    return list.filter((item) => isPinned(item.token.address));
  } else if (activeMarketTab.value === 'newest') {
    list.sort((a, b) => b.token.createdAt - a.token.createdAt);
  } else if (activeMarketTab.value === 'curve') {
    list = list.filter((item) => !item.marketData?.isGraduated);
  } else if (activeMarketTab.value === 'top') {
    list.sort((a, b) => (b.marketData?.marketCapUsd ?? 0) - (a.marketData?.marketCapUsd ?? 0));
  } else if (activeMarketTab.value === 'highvol') {
    list.sort((a, b) => (b.marketData?.volume24hUsd ?? 0) - (a.marketData?.volume24hUsd ?? 0));
  } else if (activeMarketTab.value === 'gainers') {
    list.sort((a, b) => (b.marketData?.priceChange24h ?? 0) - (a.marketData?.priceChange24h ?? 0));
  } else {
    // Trending: volume + progress
    list.sort((a, b) => {
      const volA = a.marketData?.volume24hUsd ?? 0;
      const volB = b.marketData?.volume24hUsd ?? 0;
      return (
        volB - volA ||
        (b.marketData?.graduationProgress ?? 0) - (a.marketData?.graduationProgress ?? 0)
      );
    });
  }

  return list;
});

watch([searchQuery, activeMarketTab], () => {
  currentPage.value = 1;
});

const paginatedTokens = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredTokens.value.slice(start, start + pageSize);
});

onMounted(async () => {
  loadPinnedTokens();
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    viewMode.value = 'grid';
  }
  try {
    await tokenStore.fetchTokens();
    if (tokenStore.error.value) {
      apiError.value = tokenStore.error.value;
    }
  } catch (e) {
    apiError.value = (e as Error).message;
  }
});
</script>
