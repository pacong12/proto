<script setup lang="ts">
import { computed } from 'vue';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';

export type TraderTagType =
  | 'whale'
  | 'dev'
  | 'first_buy'
  | 'sniper'
  | 'smart_money'
  | 'kol'
  | 'sell_all'
  | 'sell_partial'
  | 'buy_more'
  | 'bundled';

interface Props {
  tag: TraderTagType | string;
  size?: 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<Props>(), {
  size: 'sm',
});

interface TagMeta {
  title: string;
  description: string;
  colorClass: string;
}

const tagMetaMap: Record<TraderTagType, TagMeta> = {
  whale: {
    title: 'Whale',
    description: 'High volume trader (Holding >= 1.0% supply or >= $2,000 position)',
    colorClass: 'text-cyan-400 hover:text-cyan-300',
  },
  dev: {
    title: 'Token Creator',
    description: 'Developer / Deployer of this token',
    colorClass: 'text-amber-400 hover:text-amber-300',
  },
  first_buy: {
    title: 'First Buyer',
    description: 'Earliest buyer after token creation on bonding curve',
    colorClass: 'text-yellow-400 hover:text-yellow-300',
  },
  sniper: {
    title: 'Sniper',
    description: 'Fast buyer / bot entering within block 0/1 of launch',
    colorClass: 'text-rose-400 hover:text-rose-300',
  },
  smart_money: {
    title: 'Smart Money',
    description: 'High realized profit trader ($500+ net gain)',
    colorClass: 'text-emerald-400 hover:text-emerald-300',
  },
  kol: {
    title: 'KOL / Influencer',
    description: 'Key Opinion Leader / Verified community caller',
    colorClass: 'text-purple-400 hover:text-purple-300',
  },
  sell_all: {
    title: 'Sold All',
    description: 'Exited position completely (100% sold / clean all)',
    colorClass: 'text-red-500 hover:text-red-400',
  },
  sell_partial: {
    title: 'Sold Partial',
    description: 'Took partial profits (Token balance still held)',
    colorClass: 'text-orange-400 hover:text-orange-300',
  },
  buy_more: {
    title: 'Accumulating',
    description: 'Holding position and buying more (DCA)',
    colorClass: 'text-emerald-400 hover:text-emerald-300',
  },
  bundled: {
    title: 'Bundled',
    description: 'Part of a bundled multi-wallet launch transaction',
    colorClass: 'text-indigo-400 hover:text-indigo-300',
  },
};

const resolvedTag = computed<TraderTagType>(() => {
  const norm = String(props.tag || '').toLowerCase().trim().replace(/[-\s]/g, '_');
  if (norm === 'dev' || norm === 'developer' || norm === 'creator') return 'dev';
  if (norm === 'whale') return 'whale';
  if (norm === 'first_buy' || norm === 'first' || norm === '1st_buy' || norm === '1st') return 'first_buy';
  if (norm === 'sniper' || norm === 'sniped') return 'sniper';
  if (norm === 'smart' || norm === 'smart_money' || norm === 'smart_degen') return 'smart_money';
  if (norm === 'kol' || norm === 'caller' || norm === 'influencer') return 'kol';
  if (norm === 'sell_all' || norm === 'clean_all' || norm === 'dumped' || norm === 'exited') return 'sell_all';
  if (norm === 'sell_partial' || norm === 'partial') return 'sell_partial';
  if (norm === 'buy_more' || norm === 'dca' || norm === 'holding') return 'buy_more';
  if (norm === 'bundled' || norm === 'bundle') return 'bundled';
  return 'smart_money';
});

const meta = computed(() => tagMetaMap[resolvedTag.value] || tagMetaMap.smart_money);

const iconSizeClass = computed(() => {
  if (props.size === 'lg') return 'w-5 h-5';
  if (props.size === 'md') return 'w-4 h-4';
  return 'w-3.5 h-3.5';
});
</script>

<template>
  <TooltipProvider :delay-duration="100">
    <Tooltip>
      <TooltipTrigger as-child>
        <span
          class="inline-flex items-center justify-center cursor-help shrink-0 transition-transform hover:scale-110 select-none p-0.5"
          :class="meta.colorClass"
          :aria-label="meta.title"
        >
          <!-- 1. WHALE (Official Web3Icons WHALE.svg: https://www.web3icons.io/tokens/WHALE) -->
          <svg
            v-if="resolvedTag === 'whale'"
            :class="iconSizeClass"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill-rule="evenodd"
              d="M3 12q0-.285.017-.563H3V9.75h15.96a7.315 7.315 0 0 0-7.523-5.041V3.017A9 9 0 0 1 21 12a9 9 0 0 1-18 0m1.687 0q0-.285.022-.563h1.129a6.188 6.188 0 0 0 6.715 6.726v-1.697a4.5 4.5 0 0 1-5.018-5.029H19.29q.021.278.021.563a7.312 7.312 0 1 1-14.625 0M12 15.375a1.125 1.125 0 1 0 0-2.25a1.125 1.125 0 0 0 0 2.25"
              clip-rule="evenodd"
            />
          </svg>

          <!-- 2. DEV (Official Lucide Code-2) -->
          <svg
            v-else-if="resolvedTag === 'dev'"
            :class="iconSizeClass"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="m18 16 4-4-4-4M6 8l-4 4 4 4m8.5-12-5 16" />
          </svg>

          <!-- 3. FIRST BUY (Official Lucide Rocket) -->
          <svg
            v-else-if="resolvedTag === 'first_buy'"
            :class="iconSizeClass"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09" />
            <path d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z" />
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05" />
          </svg>

          <!-- 4. SNIPER (Official Lucide Crosshair) -->
          <svg
            v-else-if="resolvedTag === 'sniper'"
            :class="iconSizeClass"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M22 12h-4M6 12H2m10-6V2m0 20v-4" />
          </svg>

          <!-- 5. SMART MONEY (Official Lucide Brain) -->
          <svg
            v-else-if="resolvedTag === 'smart_money'"
            :class="iconSizeClass"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 18V5m3 8a4.17 4.17 0 0 1-3-4a4.17 4.17 0 0 1-3 4m8.598-6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" />
            <path d="M17.997 5.125a4 4 0 0 1 2.526 5.77" />
            <path d="M18 18a4 4 0 0 0 2-7.464" />
            <path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" />
            <path d="M6 18a4 4 0 0 1-2-7.464" />
            <path d="M6.003 5.125a4 4 0 0 0-2.526 5.77" />
          </svg>

          <!-- 6. KOL (Official Lucide Megaphone) -->
          <svg
            v-else-if="resolvedTag === 'kol'"
            :class="iconSizeClass"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
            <path d="M6 14a12 12 0 0 0 2.4 7.2a2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14M8 6v8" />
          </svg>

          <!-- 7. SELL ALL (Official Lucide Log-Out) -->
          <svg
            v-else-if="resolvedTag === 'sell_all'"
            :class="iconSizeClass"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="m16 17 5-5-5-5m5 5H9m0 9H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          </svg>

          <!-- 8. SELL PARTIAL (Official Lucide Scissors) -->
          <svg
            v-else-if="resolvedTag === 'sell_partial'"
            :class="iconSizeClass"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="6" cy="6" r="3" />
            <path d="M8.12 8.12 12 12m8-8L8.12 15.88" />
            <circle cx="6" cy="18" r="3" />
            <path d="m14.8 14.8 5.2 5.2" />
          </svg>

          <!-- 9. BUY MORE (Official Lucide Plus-Circle) -->
          <svg
            v-else-if="resolvedTag === 'buy_more'"
            :class="iconSizeClass"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12h8m-4-4v8" />
          </svg>

          <!-- 10. BUNDLED (Official Lucide Layers) -->
          <svg
            v-else-if="resolvedTag === 'bundled'"
            :class="iconSizeClass"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="m12.83 2.18 8 4.36a1 1 0 0 1 0 1.76l-8 4.36a2 2 0 0 1-1.66 0l-8-4.36a1 1 0 0 1 0-1.76l8-4.36a2 2 0 0 1 1.66 0M2 12l8.83 4.81a2 2 0 0 0 1.66 0L21 12M2 17l8.83 4.81a2 2 0 0 0 1.66 0L21 17" />
          </svg>
        </span>
      </TooltipTrigger>

      <TooltipContent side="top" class="z-50 max-w-xs font-mono text-xs p-2 bg-black border border-border text-foreground shadow-2xl">
        <p class="font-bold text-foreground">{{ meta.title }}</p>
        <p class="text-[11px] text-muted-foreground font-sans mt-0.5 leading-snug">{{ meta.description }}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
