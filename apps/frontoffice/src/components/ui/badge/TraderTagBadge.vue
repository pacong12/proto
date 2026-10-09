<script setup lang="ts">
import { computed } from 'vue';

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
  label?: string;
  size?: 'sm' | 'md';
  iconOnly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  size: 'sm',
  iconOnly: false,
});

const configMap: Record<TraderTagType, { label: string; tooltip: string; classes: string }> = {
  dev: {
    label: 'Dev',
    tooltip: 'Token Creator / Developer',
    classes: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  whale: {
    label: 'Whale',
    tooltip: 'Whale Trader (High volume / large holding)',
    classes: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  },
  first_buy: {
    label: '1st Buy',
    tooltip: 'First buyer on token bonding curve',
    classes: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  },
  sniper: {
    label: 'Sniper',
    tooltip: 'Block 0/1 Sniper Bot or Fast Buyer',
    classes: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  },
  smart_money: {
    label: 'Smart',
    tooltip: 'Smart Money (High realized profit / smart degen)',
    classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  kol: {
    label: 'KOL',
    tooltip: 'Key Opinion Leader / Verified Caller',
    classes: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  },
  sell_all: {
    label: 'Sold All',
    tooltip: 'Exited position 100% (Clean all)',
    classes: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
  sell_partial: {
    label: 'Sold Part',
    tooltip: 'Took partial profit (Holding balance remains)',
    classes: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  },
  buy_more: {
    label: 'Buy More',
    tooltip: 'Accumulating / DCA into position',
    classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  bundled: {
    label: 'Bundled',
    tooltip: 'Bundled launch transaction / Multi-wallet group',
    classes: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
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

const currentConfig = computed(() => {
  const cfg = configMap[resolvedTag.value] || configMap.smart_money;
  return {
    label: props.label || cfg.label,
    tooltip: cfg.tooltip,
    classes: cfg.classes,
  };
});
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-md border font-mono font-bold uppercase tracking-wider select-none shrink-0"
    :class="[
      currentConfig.classes,
      size === 'sm' ? 'px-1.5 py-0.5 text-[9px] h-4.5' : 'px-2 py-0.5 text-[10px] h-5',
    ]"
    :title="currentConfig.tooltip"
  >
    <!-- 1. DEV ICON (Code Brackets terminal) -->
    <svg
      v-if="resolvedTag === 'dev'"
      class="w-3 h-3 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>

    <!-- 2. WHALE ICON (Web3 Icons Whale Vector) -->
    <svg
      v-else-if="resolvedTag === 'whale'"
      class="w-3 h-3 shrink-0"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path
        fill-rule="evenodd"
        d="M2.5 13.5C2.5 9.2 6 5.8 10.5 5.8C14 5.8 17 7.8 18.5 10.2C20 9.2 21.5 8.8 22.5 8.8C22 10.8 21 12.2 19.5 13.2C20 15.2 18.5 17.8 14.5 17.8C9 17.8 2.5 16.5 2.5 13.5ZM11.5 9C10.9 9 10.5 9.4 10.5 10C10.5 10.6 10.9 11 11.5 11C12.1 11 12.5 10.6 12.5 10C12.5 9.4 12.1 9 11.5 9Z"
        clip-rule="evenodd"
      />
      <circle cx="8" cy="3.5" r="1" />
      <circle cx="10.5" cy="2.5" r="1" />
      <circle cx="13" cy="3.5" r="1" />
    </svg>

    <!-- 3. FIRST BUY ICON (Rocket / 1st Lightning) -->
    <svg
      v-else-if="resolvedTag === 'first_buy'"
      class="w-3 h-3 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>

    <!-- 4. SNIPER ICON (Crosshair Target Scope) -->
    <svg
      v-else-if="resolvedTag === 'sniper'"
      class="w-3 h-3 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>

    <!-- 5. SMART MONEY ICON (Diamond Gem) -->
    <svg
      v-else-if="resolvedTag === 'smart_money'"
      class="w-3 h-3 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M6 3h12l4 6-10 12L2 9z" />
      <path d="M2 9h20" />
      <path d="M10 3l2 6 2-6" />
      <path d="M6 3l6 18" />
      <path d="M18 3l-6 18" />
    </svg>

    <!-- 6. KOL / CALLER ICON (Megaphone) -->
    <svg
      v-else-if="resolvedTag === 'kol'"
      class="w-3 h-3 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="m3 11 18-5v12L3 13v-2z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>

    <!-- 7. SELL ALL ICON (Exit Door / Dump Out) -->
    <svg
      v-else-if="resolvedTag === 'sell_all'"
      class="w-3 h-3 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>

    <!-- 8. SELL PARTIAL ICON (Scissors / Split Profit) -->
    <svg
      v-else-if="resolvedTag === 'sell_partial'"
      class="w-3 h-3 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>

    <!-- 9. BUY MORE ICON (Accumulate / Cart Plus) -->
    <svg
      v-else-if="resolvedTag === 'buy_more'"
      class="w-3 h-3 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>

    <!-- 10. BUNDLED ICON (Multi-Wallet 3-Layer Bundle) -->
    <svg
      v-else-if="resolvedTag === 'bundled'"
      class="w-3 h-3 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="m16.5 9.4 4.5-2.8L12 2 3 6.6l4.5 2.8" />
      <path d="M3 12.5 12 17l9-4.5" />
      <path d="M3 17.5 12 22l9-4.5" />
    </svg>

    <!-- Text Label -->
    <span v-if="!iconOnly">{{ currentConfig.label }}</span>
  </span>
</template>
