<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import {
  createChart,
  AreaSeries,
  ColorType,
  CrosshairMode,
  TickMarkType,
  createTextWatermark,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type DeepPartial,
  type ChartOptions,
} from 'lightweight-charts';

export interface AreaPoint {
  time: number | string;
  value: number;
}

export interface HoverAreaPoint {
  time: Time;
  value: number;
}

interface Props {
  data: AreaPoint[];
  height?: number;
  topColor?: string;
  bottomColor?: string;
  lineColor?: string;
  lineWidth?: number;
  priceLineVisible?: boolean;
  watermarkText?: string;
  options?: DeepPartial<ChartOptions>;
}

const props = withDefaults(defineProps<Props>(), {
  height: 400,
  topColor: 'rgba(34, 197, 94, 0.28)',
  bottomColor: 'rgba(34, 197, 94, 0.01)',
  lineColor: '#22c55e',
  lineWidth: 2,
  priceLineVisible: true,
  watermarkText: '',
  options: () => ({}),
});

const emit = defineEmits<{
  (e: 'hover', point: HoverAreaPoint | null): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);

let chart: IChartApi | null = null;
let areaSeries: ISeriesApi<'Area'> | null = null;
let watermarkPlugin: any = null;
let themeObserver: MutationObserver | null = null;

let lastDataLength = 0;
let lastTimestamp: number | null = null;

function isDark(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const toSub = (n: number) => String(n).replace(/\d/g, (d) => SUB[+d]);

function formatPrice(v: number): string {
  if (!isFinite(v) || v === 0) return '0';
  if (v >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (v >= 0.0001) return v.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  const [m, e] = v.toExponential(3).split('e');
  const zeros = Math.abs(Number(e)) - 1;
  const sig = m.replace('.', '').replace(/0+$/, '');
  return `0.0${toSub(zeros)}${sig}`;
}

function formatTime(t: Time): string {
  return new Date(Number(t) * 1000).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseTime(val: number | string): Time {
  let t = typeof val === 'string' ? new Date(val).getTime() / 1000 : Number(val);
  if (t > 2_000_000_000) t = t / 1000;
  return Math.floor(t) as Time;
}

const formattedData = computed(() => {
  if (!props.data || props.data.length === 0) return [];
  const map = new Map<number, { time: Time; value: number }>();
  for (const item of props.data) {
    const t = parseTime(item.time);
    const v = Number(item.value);
    if (!isFinite(Number(t)) || !isFinite(v)) continue;
    map.set(Number(t), {
      time: t,
      value: v,
    });
  }
  return Array.from(map.values()).sort((a, b) => Number(a.time) - Number(b.time));
});

function getThemeOptions() {
  const dark = isDark();
  const line = dark ? 'rgba(39, 39, 42, 0.6)' : 'rgba(228, 228, 231, 0.8)';
  return {
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: dark ? '#a1a1aa' : '#52525b',
      fontFamily: 'Poppins, ui-sans-serif, system-ui, sans-serif',
      fontSize: 11,
    },
    grid: {
      vertLines: { color: line },
      horzLines: { color: line },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { labelBackgroundColor: dark ? '#18181b' : '#e4e4e7' },
      horzLine: { labelBackgroundColor: dark ? '#18181b' : '#e4e4e7' },
    },
  };
}

function updateWatermark() {
  if (!chart || !props.watermarkText) return;
  const dark = isDark();
  const color = dark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.035)';

  try {
    const firstPane = chart.panes()[0];
    if (!firstPane) return;

    if (!watermarkPlugin) {
      watermarkPlugin = createTextWatermark(firstPane, {
        horzAlign: 'center',
        vertAlign: 'center',
        lines: [
          {
            text: props.watermarkText.toUpperCase(),
            color,
            fontSize: 54,
            fontFamily: 'Poppins, ui-sans-serif, system-ui, sans-serif',
            fontStyle: 'bold',
          },
        ],
      });
    } else {
      watermarkPlugin.applyOptions({
        lines: [
          {
            text: props.watermarkText.toUpperCase(),
            color,
            fontSize: 54,
            fontFamily: 'Poppins, ui-sans-serif, system-ui, sans-serif',
            fontStyle: 'bold',
          },
        ],
      });
    }
  } catch {
    // Graceful fallback
  }
}

function initChart() {
  if (!containerRef.value) return;
  destroyChart();

  chart = createChart(containerRef.value, {
    autoSize: true,
    ...getThemeOptions(),
    rightPriceScale: {
      borderVisible: false,
      scaleMargins: { top: 0.1, bottom: 0.1 },
    },
    timeScale: {
      borderVisible: false,
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 6,
      barSpacing: 14,
      minBarSpacing: 3,
      tickMarkFormatter: (t: Time, type: TickMarkType) => {
        const d = new Date(Number(t) * 1000);
        if (type === TickMarkType.Time || type === TickMarkType.TimeWithSeconds) {
          return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        }
        if (type === TickMarkType.Year) return String(d.getFullYear());
        if (type === TickMarkType.Month) return d.toLocaleDateString(undefined, { month: 'short' });
        return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      },
    },
    localization: { timeFormatter: formatTime },
    ...props.options,
  });

  areaSeries = chart.addSeries(AreaSeries, {
    topColor: props.topColor,
    bottomColor: props.bottomColor,
    lineColor: props.lineColor,
    lineWidth: props.lineWidth as any,
    priceLineVisible: props.priceLineVisible,
    priceFormat: {
      type: 'custom',
      formatter: (v: number) => `$${formatPrice(v)}`,
      minMove: 1e-11,
    },
  });

  chart.subscribeCrosshairMove((param) => {
    if (!param?.time || !areaSeries) {
      emit('hover', null);
      return;
    }
    const d = param.seriesData.get(areaSeries) as any;
    if (!d || !('value' in d)) {
      emit('hover', null);
      return;
    }
    emit('hover', {
      time: param.time,
      value: Number(d.value),
    });
  });

  themeObserver = new MutationObserver(() => {
    chart?.applyOptions(getThemeOptions());
    updateWatermark();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  updateWatermark();
  syncData(formattedData.value, true);
}

function syncData(bars: typeof formattedData.value, forceFull = false) {
  if (!chart || !areaSeries) return;

  const canAppend =
    !forceFull &&
    lastDataLength > 0 &&
    bars.length >= lastDataLength &&
    bars.length - lastDataLength <= 2 &&
    Number(bars[lastDataLength - 1]?.time) === lastTimestamp;

  if (canAppend) {
    for (let i = lastDataLength - 1; i < bars.length; i++) {
      const b = bars[i];
      areaSeries.update({
        time: b.time,
        value: b.value,
      });
    }
  } else {
    areaSeries.setData(
      bars.map((b) => ({
        time: b.time,
        value: b.value,
      })),
    );
    if (bars.length > 0) {
      if (bars.length <= 25) {
        chart.timeScale().fitContent();
      } else {
        chart.timeScale().setVisibleLogicalRange({
          from: Math.max(-1, bars.length - 60),
          to: bars.length + 4,
        });
      }
    }
  }

  lastDataLength = bars.length;
  lastTimestamp = bars.length ? Number(bars[bars.length - 1].time) : null;
}

function destroyChart() {
  themeObserver?.disconnect();
  themeObserver = null;
  if (watermarkPlugin) {
    try {
      watermarkPlugin.detach();
    } catch {
      // ignore
    }
    watermarkPlugin = null;
  }
  if (chart) {
    chart.remove();
    chart = null;
  }
  areaSeries = null;
}

defineExpose({
  getChart: () => chart,
  getAreaSeries: () => areaSeries,
  fitContent: () => chart?.timeScale().fitContent(),
  scrollToRealTime: () => chart?.timeScale().scrollToRealTime(),
});

watch(formattedData, (bars) => {
  if (!chart) {
    if (containerRef.value) initChart();
    return;
  }
  syncData(bars);
});

watch(
  () => props.watermarkText,
  () => updateWatermark(),
);

onMounted(() => {
  initChart();
});

onUnmounted(() => {
  destroyChart();
});
</script>

<template>
  <div class="relative w-full overflow-hidden" :style="{ height: `${height}px` }">
    <div ref="containerRef" class="h-full w-full" />
  </div>
</template>
