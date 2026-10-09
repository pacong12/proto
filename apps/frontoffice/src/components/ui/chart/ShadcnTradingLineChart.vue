<script setup lang="ts">
import { ref, computed } from 'vue';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatPriceUsd, formatCompactUsd, formatRelativeTime } from '@/lib/utils';
import type { CandlePoint } from './TradingChart.vue';

interface Props {
  data: CandlePoint[];
  height?: number;
  tokenSymbol?: string;
  nativeSymbol?: string;
  chartMode?: 'price' | 'mcap';
  currencyMode?: 'usd' | 'native';
  multiplier?: number;
  color?: string;
}

const props = withDefaults(defineProps<Props>(), {
  height: 380,
  tokenSymbol: '',
  nativeSymbol: 'ETH',
  chartMode: 'price',
  currencyMode: 'usd',
  multiplier: 1,
  color: '',
});

const emit = defineEmits<{
  (e: 'hoverBar', bar: CandlePoint | null): void;
}>();

const svgRef = ref<SVGSVGElement | null>(null);
const activeIndex = ref<number | null>(null);

const viewWidth = 1000;
const paddingLeft = 16;
const paddingRight = 72; // Space for right Y-axis labels
const paddingTop = 28;
const paddingBottom = 48; // Space for X-axis time labels

const plotWidth = computed(() => viewWidth - paddingLeft - paddingRight);
const plotHeight = computed(() => Math.max(140, props.height - paddingTop - paddingBottom));

// Normalize and map data points with multiplier
const mappedData = computed(() => {
  const mult = props.multiplier > 0 ? props.multiplier : 1;
  return props.data.map((item) => {
    let tNum =
      typeof item.time === 'string' ? new Date(item.time).getTime() / 1000 : Number(item.time);
    if (tNum > 2_000_000_000) tNum = tNum / 1000;
    const t = Math.floor(tNum);

    const closeVal = Number(item.close) * mult;
    const openVal = Number(item.open) * mult;
    const highVal = Math.max(Number(item.high) * mult, closeVal, openVal);
    const lowVal = Math.min(Number(item.low) * mult, closeVal, openVal);
    const vol = Number(item.volume || 0);

    return {
      raw: item,
      timestamp: t,
      close: closeVal,
      open: openVal,
      high: highVal,
      low: lowVal,
      volume: vol,
    };
  });
});

// Overall trend (is last close >= first open?)
const isBullish = computed(() => {
  if (mappedData.value.length < 2) return true;
  const first = mappedData.value[0];
  const last = mappedData.value[mappedData.value.length - 1];
  return last.close >= first.open;
});

// Theme accent color: dynamic green/red or props.color
const lineColor = computed(() => {
  if (props.color) return props.color;
  return isBullish.value ? '#22c55e' : '#ef4444';
});

// Dynamic min & max price with margin
const priceStats = computed(() => {
  if (mappedData.value.length === 0) return { min: 0, max: 1 };
  const closes = mappedData.value.map((d) => d.close);
  const minRaw = Math.min(...closes);
  const maxRaw = Math.max(...closes);

  if (minRaw === maxRaw) {
    const margin = minRaw > 0 ? minRaw * 0.05 : 0.01;
    return {
      min: Math.max(0, minRaw - margin),
      max: maxRaw + margin,
    };
  }

  const range = maxRaw - minRaw;
  const pad = range * 0.1; // 10% vertical padding
  return {
    min: Math.max(0, minRaw - pad),
    max: maxRaw + pad,
  };
});

// Max volume for volume bars
const maxVolume = computed(() => {
  const vols = mappedData.value.map((d) => d.volume);
  const m = Math.max(...vols, 0);
  return m > 0 ? m : 1;
});

// Calculate SVG coordinate points
const points = computed(() => {
  const n = mappedData.value.length;
  if (n === 0) return [];
  const { min, max } = priceStats.value;
  const range = max - min || 1;
  const w = plotWidth.value;
  const h = plotHeight.value;
  const step = n > 1 ? w / (n - 1) : w;

  return mappedData.value.map((d, i) => {
    const x = paddingLeft + i * step;
    const norm = (d.close - min) / range;
    const y = paddingTop + h - norm * h;
    return {
      x,
      y,
      data: d,
    };
  });
});

// Volume histogram bars (rendered in bottom 24% of the plot)
const volumeBars = computed(() => {
  const n = mappedData.value.length;
  if (n === 0) return [];
  const maxVol = maxVolume.value;
  const w = plotWidth.value;
  const step = w / n;
  const barW = Math.max(2, Math.min(18, step * 0.7));
  const maxBarH = plotHeight.value * 0.22;
  const baselineY = paddingTop + plotHeight.value;

  return mappedData.value.map((d, i) => {
    const bh = d.volume > 0 ? Math.max(2, (d.volume / maxVol) * maxBarH) : 0;
    const x = paddingLeft + i * step + (step - barW) / 2;
    const y = baselineY - bh;
    const isUp = d.close >= d.open;
    return {
      x,
      y,
      width: barW,
      height: bh,
      color: isUp ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)',
    };
  });
});

// Smooth cubic bezier spline line path
const linePath = computed(() => {
  const pts = points.value;
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;

    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
});

// Area closed path for gradient fill
const areaPath = computed(() => {
  if (!linePath.value || points.value.length === 0) return '';
  const pts = points.value;
  const firstX = pts[0].x;
  const lastX = pts[pts.length - 1].x;
  const bottomY = paddingTop + plotHeight.value;

  return `${linePath.value} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
});

// Horizontal Y-Axis Price Ticks (3 ticks: Top, Mid, Bottom)
const yAxisTicks = computed(() => {
  const { min, max } = priceStats.value;
  const h = plotHeight.value;
  const mid = (min + max) / 2;

  return [
    { y: paddingTop, value: max },
    { y: paddingTop + h / 2, value: mid },
    { y: paddingTop + h, value: min },
  ];
});

// Vertical X-Axis Time Ticks (up to 5 evenly distributed labels)
const xAxisTicks = computed(() => {
  const n = mappedData.value.length;
  if (n === 0) return [];
  const count = Math.min(5, n);
  if (count <= 1) {
    const d = mappedData.value[0];
    return [{ x: paddingLeft + plotWidth.value / 2, label: formatTickTime(d.timestamp) }];
  }

  const indices: number[] = [];
  const step = (n - 1) / (count - 1);
  for (let i = 0; i < count; i++) {
    indices.push(Math.round(i * step));
  }

  return indices.map((idx) => {
    const pt = points.value[idx];
    return {
      x: pt.x,
      label: formatTickTime(pt.data.timestamp),
    };
  });
});

function formatTickTime(ts: number): string {
  if (!ts || ts <= 0) return '';
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatFullTime(ts: number): string {
  if (!ts || ts <= 0) return '';
  const d = new Date(ts * 1000);
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`;
}

// Hover state tracking
const activePoint = computed(() => {
  if (activeIndex.value === null) return null;
  return points.value[activeIndex.value] || null;
});

function handlePointerMove(e: PointerEvent) {
  if (!svgRef.value || points.value.length === 0) return;
  const rect = svgRef.value.getBoundingClientRect();
  if (rect.width <= 0) return;

  const relX = (e.clientX - rect.left) / rect.width;
  const targetSvgX = relX * viewWidth;
  const n = points.value.length;

  if (n <= 1) {
    activeIndex.value = 0;
    emit('hoverBar', props.data[0]);
    return;
  }

  const step = plotWidth.value / (n - 1);
  const rawIdx = Math.round((targetSvgX - paddingLeft) / step);
  const clampedIdx = Math.max(0, Math.min(n - 1, rawIdx));
  activeIndex.value = clampedIdx;

  const pt = points.value[clampedIdx];
  if (pt) {
    emit('hoverBar', pt.data.raw);
  }
}

function handlePointerLeave() {
  activeIndex.value = null;
  emit('hoverBar', null);
}

// Format price with appropriate decimals
function formatDisplayPrice(val: number): string {
  if (props.chartMode === 'mcap') {
    return '$' + formatCompactUsd(val);
  }
  if (props.currencyMode === 'native') {
    if (val < 0.00000001) return `${val.toFixed(10)} ${props.nativeSymbol}`;
    if (val < 0.0001) return `${val.toFixed(7)} ${props.nativeSymbol}`;
    return `${val.toFixed(4)} ${props.nativeSymbol}`;
  }
  return formatPriceUsd(val);
}
</script>

<template>
  <div
    class="shadcn-trading-chart relative w-full select-none bg-black rounded-2xl overflow-hidden"
  >
    <!-- Empty state -->
    <div
      v-if="data.length === 0"
      class="flex items-center justify-center h-64 text-muted-foreground font-mono text-xs"
    >
      No chart data available for this range.
    </div>

    <div v-else class="relative w-full">
      <svg
        ref="svgRef"
        :viewBox="`0 0 ${viewWidth} ${height}`"
        class="w-full h-auto overflow-visible cursor-crosshair block bg-black"
        preserveAspectRatio="none"
        role="img"
        aria-label="Interactive Shadcn Area Price Chart"
        @pointermove="handlePointerMove"
        @pointerdown="handlePointerMove"
        @pointerleave="handlePointerLeave"
      >
        <defs>
          <!-- Signature Shadcn Area Neon Gradient -->
          <linearGradient id="shadcn-trading-glow-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="lineColor" stop-opacity="0.38" />
            <stop offset="65%" :stop-color="lineColor" stop-opacity="0.08" />
            <stop offset="100%" :stop-color="lineColor" stop-opacity="0.0" />
          </linearGradient>

          <!-- Neon Glow Line Filter -->
          <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <!-- Horizontal Dashed Gridlines -->
        <g class="chart-grid text-border/50">
          <line
            v-for="(tick, idx) in yAxisTicks"
            :key="idx"
            :x1="paddingLeft"
            :x2="paddingLeft + plotWidth"
            :y1="tick.y"
            :y2="tick.y"
            stroke="currentColor"
            stroke-dasharray="3 4"
            stroke-width="1"
          />
        </g>

        <!-- Volume Histogram Bars (Under Area Fill) -->
        <g class="chart-volume">
          <rect
            v-for="(bar, bIdx) in volumeBars"
            :key="`vol-${bIdx}`"
            :x="bar.x"
            :y="bar.y"
            :width="bar.width"
            :height="bar.height"
            :fill="bar.color"
            rx="1"
          />
        </g>

        <!-- Area Fill with Gradient -->
        <path
          :d="areaPath"
          fill="url(#shadcn-trading-glow-gradient)"
          class="transition-opacity duration-300"
        />

        <!-- Glowing Base Line (Blur underlay) -->
        <path
          :d="linePath"
          fill="none"
          :stroke="lineColor"
          stroke-width="4"
          stroke-linecap="round"
          stroke-linejoin="round"
          filter="url(#neon-glow)"
          opacity="0.45"
        />

        <!-- Main Crisp Spline Line -->
        <path
          :d="linePath"
          fill="none"
          :stroke="lineColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <!-- Y-Axis Price Labels (Right column) -->
        <g class="chart-y-axis font-mono text-[10px]">
          <text
            v-for="(tick, tIdx) in yAxisTicks"
            :key="`y-lbl-${tIdx}`"
            :x="paddingLeft + plotWidth + 8"
            :y="tick.y + 3"
            fill="currentColor"
            class="text-muted-foreground/80 font-semibold"
          >
            {{ formatDisplayPrice(tick.value) }}
          </text>
        </g>

        <!-- X-Axis Time Labels (Bottom row) -->
        <g class="chart-x-axis font-mono text-[10px]">
          <text
            v-for="(xTick, xIdx) in xAxisTicks"
            :key="`x-lbl-${xIdx}`"
            :x="xTick.x"
            :y="paddingTop + plotHeight + 22"
            fill="currentColor"
            text-anchor="middle"
            class="text-muted-foreground/70"
          >
            {{ xTick.label }}
          </text>
        </g>

        <!-- Interactive Crosshair & Hover Marker -->
        <g v-if="activePoint" class="chart-crosshair pointer-events-none">
          <!-- Vertical Crosshair Line -->
          <line
            :x1="activePoint.x"
            :x2="activePoint.x"
            :y1="paddingTop"
            :y2="paddingTop + plotHeight"
            stroke="currentColor"
            class="text-muted-foreground/60"
            stroke-dasharray="2 3"
            stroke-width="1"
          />

          <!-- Horizontal Crosshair Line to Y-Axis -->
          <line
            :x1="paddingLeft"
            :x2="paddingLeft + plotWidth"
            :y1="activePoint.y"
            :y2="activePoint.y"
            stroke="currentColor"
            class="text-muted-foreground/60"
            stroke-dasharray="2 3"
            stroke-width="1"
          />

          <!-- Glowing Ping Ring on Hover Point -->
          <circle
            :cx="activePoint.x"
            :cy="activePoint.y"
            r="8"
            :fill="lineColor"
            fill-opacity="0.25"
            class="animate-ping"
          />

          <!-- Center Hover Dot -->
          <circle
            :cx="activePoint.x"
            :cy="activePoint.y"
            r="4.5"
            :fill="lineColor"
            stroke="#000000"
            stroke-width="2"
          />
        </g>
      </svg>

      <!-- Floating Interactive Tooltip Card (Official Shadcn Card Component) -->
      <Card
        v-if="activePoint"
        class="absolute pointer-events-none z-30 transition-all duration-75 ease-out shadow-2xl rounded-xl border border-border/80 bg-zinc-950/95 p-2.5 text-xs font-mono text-zinc-100 backdrop-blur-md"
        :style="{
          left: `${Math.min(Math.max(16, (activePoint.x / viewWidth) * 100), 78)}%`,
          top: `${Math.min(Math.max(12, (activePoint.y / height) * 100 - 18), 65)}%`,
          transform: 'translate(-50%, -100%)',
        }"
      >
        <div class="space-y-1">
          <!-- Time Row -->
          <div
            class="text-[10px] text-muted-foreground font-semibold flex items-center justify-between gap-3"
          >
            <span>{{ formatFullTime(activePoint.data.timestamp) }}</span>
            <Badge
              v-if="activePoint.data.open > 0"
              :variant="activePoint.data.close >= activePoint.data.open ? 'default' : 'destructive'"
              class="px-1 py-0 h-3.5 text-[9px] font-mono font-bold leading-none"
            >
              {{ activePoint.data.close >= activePoint.data.open ? '+' : ''
              }}{{
                (
                  ((activePoint.data.close - activePoint.data.open) / activePoint.data.open) *
                  100
                ).toFixed(2)
              }}%
            </Badge>
          </div>

          <!-- Price Row -->
          <div class="flex items-baseline justify-between gap-4">
            <span class="text-muted-foreground text-[10px]">Price:</span>
            <span class="font-extrabold text-foreground text-sm">
              {{ formatDisplayPrice(activePoint.data.close) }}
            </span>
          </div>

          <!-- Volume Row (if present) -->
          <div
            v-if="activePoint.data.volume > 0"
            class="flex items-baseline justify-between gap-4 pt-0.5 border-t border-border/50 text-[10px]"
          >
            <span class="text-muted-foreground">Volume:</span>
            <span class="text-foreground font-semibold">
              ${{ formatCompactUsd(activePoint.data.volume) }}
            </span>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.shadcn-trading-chart {
  contain: layout style;
}
</style>
