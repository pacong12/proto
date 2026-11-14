<script setup lang="ts">
import { computed, ref } from 'vue';

export interface ChartDataPoint {
  label: string;
  value: number;
  timestamp?: number;
}

interface Props {
  data: ChartDataPoint[];
  height?: number;
  color?: string; // hex or rgb (e.g. #0ea5e9, #10b981, #f59e0b)
  gradientId?: string;
  unit?: string;
  isCurrency?: boolean;
  mode?: 'area' | 'bar';
}

const props = withDefaults(defineProps<Props>(), {
  height: 240,
  color: 'var(--chart-1)',
  gradientId: 'shadcn-chart-gradient',
  unit: '',
  isCurrency: false,
  mode: 'area',
});

/*
 * Geometry. The plot is drawn in a 1000-wide viewBox stretched to the container's width
 * (preserveAspectRatio="none") at a fixed pixel height, so y is in pixels and x in per-mille of
 * the width. Every bucket owns an equal band; its point, bar, label and hover target all sit at
 * the band's centre, so the area, the bars, the x labels and the tooltip always line up.
 */
const VIEW_WIDTH = 1000;
const TOP = 12;
const BOTTOM = 8;
const MAX_X_LABELS = 6;
const Y_TICKS = 4;

const activeIndex = ref<number | null>(null);
const plotRef = ref<HTMLDivElement | null>(null);

const plotHeight = computed(() => Math.max(120, props.height - 28));
const innerHeight = computed(() => plotHeight.value - TOP - BOTTOM);
const band = computed(() => VIEW_WIDTH / Math.max(1, props.data.length));
const centerX = (i: number) => (i + 0.5) * band.value;

/** 1, 2, 2.5 or 5 times a power of ten: the smallest such step covering `raw`. */
function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return nice * power;
}

/** Y axis from 0 to a round number at or above the largest value, in four equal steps. */
const yTicks = computed(() => {
  const max = Math.max(0, ...props.data.map((d) => d.value));
  let step = max > 0 ? niceStep(max / Y_TICKS) : 1;
  // Counts (launches) step in whole units.
  if (!props.isCurrency) step = Math.max(1, Math.ceil(step));
  return Array.from({ length: Y_TICKS + 1 }, (_, i) => i * step);
});
const yMax = computed(() => yTicks.value[yTicks.value.length - 1] || 1);
const yOf = (value: number) => TOP + innerHeight.value * (1 - Math.max(0, value) / yMax.value);
const baseline = computed(() => TOP + innerHeight.value);

const points = computed(() =>
  props.data.map((d, i) => ({ x: centerX(i), y: yOf(d.value), data: d })),
);

/** A smooth line through the points whose control points never overshoot (no dips below 0). */
const linePath = computed(() => {
  const pts = points.value;
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M 0 ${pts[0].y} L ${VIEW_WIDTH} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const lo = Math.min(p1.y, p2.y);
    const hi = Math.max(p1.y, p2.y);
    const clampY = (y: number) => Math.min(hi, Math.max(lo, y));
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = clampY(p2.y - (p3.y - p1.y) / 6);
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
});

const areaPath = computed(() => {
  const pts = points.value;
  if (!linePath.value || pts.length === 0) return '';
  const first = pts.length === 1 ? 0 : pts[0].x;
  const last = pts.length === 1 ? VIEW_WIDTH : pts[pts.length - 1].x;
  return `${linePath.value} L ${last} ${baseline.value} L ${first} ${baseline.value} Z`;
});

const bars = computed(() => {
  const width = band.value * 0.6;
  return props.data.map((d, i) => {
    const top = d.value > 0 ? Math.min(yOf(d.value), baseline.value - 2) : baseline.value;
    return { x: centerX(i) - width / 2, y: top, width, height: baseline.value - top };
  });
});

/** X labels: every bucket when they fit, else evenly spaced ones that always include the last. */
const xLabels = computed(() => {
  const n = props.data.length;
  if (n === 0) return [];
  const every = Math.max(1, Math.ceil(n / MAX_X_LABELS));
  const shown = new Set<number>();
  for (let i = n - 1; i >= 0; i -= every) shown.add(i);
  return [...shown]
    .sort((a, b) => a - b)
    .map((i) => ({ i, label: props.data[i].label, left: (centerX(i) / VIEW_WIDTH) * 100 }));
});

const activePoint = computed(() =>
  activeIndex.value === null ? null : (points.value[activeIndex.value] ?? null),
);
const activeLeft = computed(() =>
  activePoint.value ? (activePoint.value.x / VIEW_WIDTH) * 100 : 0,
);

function handlePointerMove(e: PointerEvent) {
  const el = plotRef.value;
  const n = props.data.length;
  if (!el || n === 0) return;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0) return;
  const rel = (e.clientX - rect.left) / rect.width;
  activeIndex.value = Math.max(0, Math.min(n - 1, Math.floor(rel * n)));
}

function handlePointerLeave() {
  activeIndex.value = null;
}

const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Axis labels: $0, $250, $1.5K; counts as 0, 5, 10. */
function formatTick(value: number): string {
  if (props.isCurrency) return `$${compactNumber.format(value)}`;
  return compactNumber.format(value);
}

function formatValue(val: number): string {
  if (props.isCurrency) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: val >= 1000 ? 0 : 2,
    }).format(val);
  }
  if (props.unit) return `${val.toLocaleString()} ${props.unit}`;
  return val.toLocaleString();
}
</script>

<template>
  <div class="w-full select-none font-sans">
    <div
      v-if="data.length === 0"
      class="flex items-center justify-center h-48 text-muted-foreground text-xs"
    >
      No chart data available for this range.
    </div>

    <div v-else class="flex w-full gap-2">
      <!-- Y axis: round values from 0, level with the grid lines -->
      <div class="relative shrink-0 w-12" :style="{ height: `${plotHeight}px` }" aria-hidden="true">
        <span
          v-for="tick in yTicks"
          :key="tick"
          class="absolute right-0 -translate-y-1/2 text-xs tabular-nums text-muted-foreground"
          :style="{ top: `${yOf(tick)}px` }"
        >
          {{ formatTick(tick) }}
        </span>
      </div>

      <div class="relative min-w-0 flex-1">
        <div
          ref="plotRef"
          class="relative w-full cursor-crosshair"
          :style="{ height: `${plotHeight}px` }"
          @pointermove="handlePointerMove"
          @pointerdown="handlePointerMove"
          @pointerleave="handlePointerLeave"
        >
          <svg
            :viewBox="`0 0 ${VIEW_WIDTH} ${plotHeight}`"
            preserveAspectRatio="none"
            class="absolute inset-0 w-full h-full overflow-visible"
            role="img"
          >
            <defs>
              <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" :stop-color="color" stop-opacity="0.35" />
                <stop offset="85%" :stop-color="color" stop-opacity="0.04" />
                <stop offset="100%" :stop-color="color" stop-opacity="0" />
              </linearGradient>
            </defs>

            <line
              v-for="(tick, i) in yTicks"
              :key="tick"
              x1="0"
              :x2="VIEW_WIDTH"
              :y1="yOf(tick)"
              :y2="yOf(tick)"
              stroke="currentColor"
              :class="i === 0 ? 'text-border' : 'text-border/50'"
              :stroke-dasharray="i === 0 ? undefined : '3 3'"
              stroke-width="1"
              vector-effect="non-scaling-stroke"
            />

            <template v-if="mode === 'area'">
              <path v-if="areaPath" :d="areaPath" :fill="`url(#${gradientId})`" />
              <path
                v-if="linePath"
                :d="linePath"
                fill="none"
                :stroke="color"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                vector-effect="non-scaling-stroke"
              />
            </template>

            <g v-else>
              <rect
                v-for="(b, i) in bars"
                :key="i"
                :x="b.x"
                :y="b.y"
                :width="b.width"
                :height="b.height"
                :fill="color"
                class="transition-opacity duration-150"
                :class="activeIndex === null || activeIndex === i ? 'opacity-100' : 'opacity-50'"
              />
            </g>

            <line
              v-if="activePoint"
              :x1="activePoint.x"
              :x2="activePoint.x"
              :y1="TOP"
              :y2="baseline"
              stroke="currentColor"
              class="text-muted-foreground/60"
              stroke-dasharray="3 3"
              stroke-width="1"
              vector-effect="non-scaling-stroke"
            />
          </svg>

          <!-- The hovered point, drawn in HTML so the stretched viewBox cannot squash it -->
          <span
            v-if="activePoint && mode === 'area'"
            class="pointer-events-none absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-background"
            :style="{
              left: `${activeLeft}%`,
              top: `${activePoint.y}px`,
              borderColor: color,
            }"
          />

          <div
            v-if="activePoint"
            class="pointer-events-none absolute top-0 z-30 rounded-xl bg-popover/95 text-popover-foreground border border-border shadow-lg p-2.5 backdrop-blur-md text-xs"
            :style="{
              left: `clamp(60px, ${activeLeft}%, calc(100% - 60px))`,
              transform: 'translateX(-50%)',
            }"
          >
            <div class="flex flex-col gap-1 min-w-[100px]">
              <span class="text-xs text-muted-foreground">{{ activePoint.data.label }}</span>
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-xs shrink-0" :style="{ backgroundColor: color }" />
                <strong class="text-sm font-semibold text-foreground tabular-nums">
                  {{ formatValue(activePoint.data.value) }}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <!-- X axis: each label under its own bucket -->
        <div class="relative h-6 mt-1.5" aria-hidden="true">
          <span
            v-for="x in xLabels"
            :key="x.i"
            class="absolute -translate-x-1/2 whitespace-nowrap text-xs tabular-nums text-muted-foreground"
            :style="{ left: `${x.left}%` }"
          >
            {{ x.label }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
