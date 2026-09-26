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
  title?: string;
  subtitle?: string;
  totalDisplay?: string;
  unit?: string;
  isCurrency?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  height: 190,
  title: '',
  subtitle: '',
  totalDisplay: '',
  unit: '',
  isCurrency: false,
});

const activeIndex = ref<number | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);

const viewWidth = 720;
const paddingX = 8;
const topPadding = 16;
const bottomPadding = 32;

const chartHeight = computed(() => Math.max(100, props.height - topPadding - bottomPadding));

const values = computed(() => props.data.map((d) => d.value));

const maxValue = computed(() => {
  const max = Math.max(...values.value, 0);
  return max > 0 ? max : 1;
});

const barWidth = computed(() => {
  const n = props.data.length;
  if (n === 0) return 0;
  const availableWidth = viewWidth - paddingX * 2;
  const step = availableWidth / n;
  return Math.max(4, Math.min(24, step * 0.65));
});

const barStep = computed(() => {
  const n = props.data.length;
  if (n === 0) return 0;
  return (viewWidth - paddingX * 2) / n;
});

const bars = computed(() => {
  const n = props.data.length;
  const h = chartHeight.value;
  const max = maxValue.value;
  const step = barStep.value;
  const bw = barWidth.value;

  return props.data.map((point, i) => {
    const val = point.value;
    const barHeight = val <= 0 ? 0 : Math.max(3, (val / max) * h);
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

const cursorX = computed(() => {
  if (activeIndex.value === null || !bars.value[activeIndex.value]) return null;
  const bar = bars.value[activeIndex.value];
  return bar.x + bar.width / 2;
});

const activePoint = computed(() => {
  if (activeIndex.value === null) return null;
  return props.data[activeIndex.value] || null;
});

function handlePointerMove(e: PointerEvent) {
  if (!svgRef.value || props.data.length === 0) return;
  const rect = svgRef.value.getBoundingClientRect();
  if (rect.width <= 0) return;

  const relX = (e.clientX - rect.left) / rect.width;
  const targetSvgX = relX * viewWidth;
  const clampedX = Math.max(paddingX, Math.min(viewWidth - paddingX, targetSvgX));
  const step = barStep.value;
  const index = Math.floor((clampedX - paddingX) / step);

  activeIndex.value = Math.min(props.data.length - 1, Math.max(0, index));
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
  <div class="analytics-chart-container w-full select-none">
    <div
      class="analytics-chart-stage relative rounded-2xl p-4 overflow-hidden border border-border bg-card backdrop-blur-sm"
    >
      <div v-if="data.length === 0" class="flex items-center justify-center h-48">
        <p class="text-xs font-serif text-muted-foreground italic">No historical data available.</p>
      </div>

      <div v-else class="relative w-full">
        <svg
          ref="svgRef"
          :viewBox="`0 0 ${viewWidth} ${height}`"
          class="w-full h-auto overflow-visible cursor-crosshair block"
          preserveAspectRatio="none"
          role="img"
          aria-label="Daily volume and transaction trends"
          @pointermove="handlePointerMove"
          @pointerdown="handlePointerMove"
          @pointerleave="handlePointerLeave"
        >
          <!-- Chart Baseline Line -->
          <line
            :x1="paddingX"
            :x2="viewWidth - paddingX"
            :y1="topPadding + chartHeight"
            :y2="topPadding + chartHeight"
            class="stroke-border"
            stroke-width="1"
          />

          <!-- Vertical Interactive Cursor Line -->
          <line
            v-if="cursorX !== null"
            :x1="cursorX"
            :x2="cursorX"
            :y1="topPadding"
            :y2="topPadding + chartHeight"
            class="stroke-muted-foreground"
            stroke-width="1"
            stroke-dasharray="4 4"
          />

          <!-- Interactive Bars Group -->
          <g :class="['chart-bars', { 'is-hovering': activeIndex !== null }]">
            <rect
              v-for="(b, i) in bars"
              :key="i"
              :x="b.x"
              :y="b.y"
              :width="b.width"
              :height="b.height"
              :rx="b.rx"
              :class="[
                'transition-all duration-150',
                i === activeIndex
                  ? 'fill-foreground opacity-100'
                  : 'fill-muted-foreground opacity-50 hover:opacity-90',
              ]"
            />
          </g>
        </svg>

        <!-- Floating Tooltip -->
        <div
          v-if="activePoint !== null && cursorX !== null"
          class="analytics-chart-tooltip pointer-events-none absolute top-2 rounded-lg bg-popover text-popover-foreground border border-border shadow-xl px-3 py-1.5 backdrop-blur-md z-10 transition-all duration-75"
          :style="{
            left: `clamp(60px, ${(cursorX / viewWidth) * 100}%, calc(100% - 60px))`,
            transform: 'translateX(-50%)',
          }"
        >
          <div class="flex flex-col gap-0.5 text-center">
            <span class="text-[11px] font-mono tracking-tight text-muted-foreground">
              {{ activePoint.label }}
            </span>
            <strong class="text-xs font-serif font-bold tabular-nums">
              {{ formatValue(activePoint.value) }}
            </strong>
          </div>
        </div>

        <!-- Horizontal X-Axis Ticks -->
        <div
          class="flex justify-between px-2 pt-2 text-[10px] font-mono tabular-nums text-muted-foreground"
        >
          <span>{{ data[0]?.label }}</span>
          <span v-if="data.length > 2">{{ data[Math.floor(data.length / 2)]?.label }}</span>
          <span>{{ data[data.length - 1]?.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-bars.is-hovering rect:not(:hover) {
  opacity: 0.35;
}
</style>
