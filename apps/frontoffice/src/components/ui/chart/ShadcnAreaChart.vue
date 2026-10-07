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

const activeIndex = ref<number | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);

const viewWidth = 800;
const paddingX = 16;
const topPadding = 24;
const bottomPadding = 36;

const chartHeight = computed(() => Math.max(120, props.height - topPadding - bottomPadding));

const values = computed(() => props.data.map((d) => d.value));

const maxValue = computed(() => {
  const max = Math.max(...values.value, 0);
  return max > 0 ? max : 1;
});

const minValue = computed(() => {
  return 0; // Baseline at 0 for volume/launches
});

// Calculate coordinates for points
const points = computed(() => {
  const n = props.data.length;
  if (n === 0) return [];
  const max = maxValue.value;
  const min = minValue.value;
  const h = chartHeight.value;
  const availableWidth = viewWidth - paddingX * 2;
  const step = n > 1 ? availableWidth / (n - 1) : availableWidth;

  return props.data.map((d, i) => {
    const x = paddingX + i * step;
    const norm = (d.value - min) / (max - min || 1);
    const y = topPadding + h - norm * h;
    return { x, y, data: d };
  });
});

// Generate smooth cubic bezier SVG path (Shadcn / Spline curve)
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
  const bottomY = topPadding + chartHeight.value;

  return `${linePath.value} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
});

// Bar columns if mode === 'bar'
const bars = computed(() => {
  const n = props.data.length;
  if (n === 0) return [];
  const h = chartHeight.value;
  const max = maxValue.value;
  const availableWidth = viewWidth - paddingX * 2;
  const step = availableWidth / n;
  const bw = Math.max(8, Math.min(36, step * 0.65));

  return props.data.map((point, i) => {
    const val = point.value;
    const barHeight = val <= 0 ? 0 : Math.max(4, (val / max) * h);
    const x = paddingX + i * step + (step - bw) / 2;
    const y = topPadding + h - barHeight;

    return {
      x,
      y,
      width: bw,
      height: barHeight,
      rx: Math.min(4, bw / 2),
      point,
    };
  });
});

// Interactive hover tracking
const activePoint = computed(() => {
  if (activeIndex.value === null) return null;
  return points.value[activeIndex.value] || null;
});

const cursorX = computed(() => {
  if (activePoint.value) return activePoint.value.x;
  return null;
});

function handlePointerMove(e: PointerEvent) {
  if (!svgRef.value || props.data.length === 0) return;
  const rect = svgRef.value.getBoundingClientRect();
  if (rect.width <= 0) return;

  const relX = (e.clientX - rect.left) / rect.width;
  const targetSvgX = relX * viewWidth;
  const availableWidth = viewWidth - paddingX * 2;
  const n = props.data.length;

  if (n <= 1) {
    activeIndex.value = 0;
    return;
  }

  const step = availableWidth / (n - 1);
  const index = Math.round((targetSvgX - paddingX) / step);
  activeIndex.value = Math.max(0, Math.min(n - 1, index));
}

function handlePointerLeave() {
  activeIndex.value = null;
}

function formatValue(val: number): string {
  if (props.isCurrency) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: val >= 1000 ? 0 : 2,
    }).format(val);
  }
  if (props.unit) {
    return `${val.toLocaleString()} ${props.unit}`;
  }
  return val.toLocaleString();
}
</script>

<template>
  <div class="shadcn-chart-root w-full select-none font-sans">
    <div class="relative w-full overflow-hidden">
      <!-- Empty state -->
      <div v-if="data.length === 0" class="flex items-center justify-center h-48 text-muted-foreground font-mono text-xs">
        No chart data available for this range.
      </div>

      <div v-else class="relative w-full">
        <svg
          ref="svgRef"
          :viewBox="`0 0 ${viewWidth} ${height}`"
          class="w-full h-auto overflow-visible cursor-crosshair block"
          preserveAspectRatio="none"
          role="img"
          @pointermove="handlePointerMove"
          @pointerdown="handlePointerMove"
          @pointerleave="handlePointerLeave"
        >
          <defs>
            <!-- Shadcn Linear Gradient for Area Fill -->
            <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" :stop-color="color" stop-opacity="0.35" />
              <stop offset="85%" :stop-color="color" stop-opacity="0.04" />
              <stop offset="100%" :stop-color="color" stop-opacity="0" />
            </linearGradient>
          </defs>

          <!-- Horizontal Grid Lines (Shadcn style dashed lines) -->
          <g class="chart-grid">
            <line
              :x1="paddingX"
              :x2="viewWidth - paddingX"
              :y1="topPadding"
              :y2="topPadding"
              stroke="currentColor"
              class="text-border/40"
              stroke-dasharray="3 3"
              stroke-width="1"
            />
            <line
              :x1="paddingX"
              :x2="viewWidth - paddingX"
              :y1="topPadding + chartHeight / 2"
              :y2="topPadding + chartHeight / 2"
              stroke="currentColor"
              class="text-border/40"
              stroke-dasharray="3 3"
              stroke-width="1"
            />
            <line
              :x1="paddingX"
              :x2="viewWidth - paddingX"
              :y1="topPadding + chartHeight"
              :y2="topPadding + chartHeight"
              stroke="currentColor"
              class="text-border/70"
              stroke-width="1"
            />
          </g>

          <!-- MODE: AREA CHART (Shadcn UI Area Chart) -->
          <template v-if="mode === 'area'">
            <!-- Gradient Area Fill -->
            <path v-if="areaPath" :d="areaPath" :fill="`url(#${gradientId})`" />

            <!-- Smooth Spline Line -->
            <path
              v-if="linePath"
              :d="linePath"
              fill="none"
              :stroke="color"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </template>

          <!-- MODE: BAR CHART (Shadcn UI Bar Chart) -->
          <template v-else-if="mode === 'bar'">
            <g class="chart-bars">
              <rect
                v-for="(b, i) in bars"
                :key="i"
                :x="b.x"
                :y="b.y"
                :width="b.width"
                :height="b.height"
                :rx="b.rx"
                :fill="color"
                :class="[
                  'transition-all duration-150',
                  activeIndex === i ? 'opacity-100 brightness-110' : 'opacity-70 hover:opacity-100',
                ]"
              />
            </g>
          </template>

          <!-- Active Hover Vertical Crosshair -->
          <g v-if="cursorX !== null">
            <line
              :x1="cursorX"
              :x2="cursorX"
              :y1="topPadding"
              :y2="topPadding + chartHeight"
              stroke="currentColor"
              class="text-muted-foreground/60"
              stroke-dasharray="3 3"
              stroke-width="1"
            />
          </g>

          <!-- Active Hover Circle Dot -->
          <g v-if="activePoint && mode === 'area'">
            <circle
              :cx="activePoint.x"
              :cy="activePoint.y"
              r="6"
              class="fill-background"
              :stroke="color"
              stroke-width="3"
            />
            <circle :cx="activePoint.x" :cy="activePoint.y" r="2.5" :fill="color" />
          </g>
        </svg>

        <!-- Official Shadcn Style Floating Tooltip Card -->
        <div
          v-if="activePoint !== null && cursorX !== null"
          class="pointer-events-none absolute top-1 rounded-xl bg-popover/95 text-popover-foreground border border-border shadow-2xl p-2.5 backdrop-blur-md z-30 transition-all duration-75 font-mono text-xs"
          :style="{
            left: `clamp(80px, ${(cursorX / viewWidth) * 100}%, calc(100% - 80px))`,
            transform: 'translateX(-50%)',
          }"
        >
          <div class="flex flex-col gap-1 min-w-[100px]">
            <span class="text-[11px] text-muted-foreground uppercase font-semibold">
              {{ activePoint.data.label }}
            </span>
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-xs shrink-0" :style="{ backgroundColor: color }" />
              <strong class="text-sm font-bold text-foreground tabular-nums">
                {{ formatValue(activePoint.data.value) }}
              </strong>
            </div>
          </div>
        </div>

        <!-- Horizontal X-Axis Labels -->
        <div
          class="flex justify-between px-3 pt-2 text-[11px] font-mono tabular-nums text-muted-foreground select-none"
        >
          <span>{{ data[0]?.label }}</span>
          <span v-if="data.length > 2">{{ data[Math.floor(data.length / 2)]?.label }}</span>
          <span>{{ data[data.length - 1]?.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
