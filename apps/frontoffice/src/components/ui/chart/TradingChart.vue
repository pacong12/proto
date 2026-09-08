<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import {
  createChart,
  CandlestickSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';

export interface CandlePoint {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface Props {
  data: CandlePoint[];
  tokenSymbol?: string;
  height?: number;
}

const props = withDefaults(defineProps<Props>(), {
  tokenSymbol: '',
  height: 380,
});

const chartContainer = ref<HTMLDivElement | null>(null);
let chart: IChartApi | null = null;
let series: ISeriesApi<'Candlestick'> | null = null;
let resizeObserver: ResizeObserver | null = null;
let themeObserver: MutationObserver | null = null;

const hoveredBar = ref<CandlePoint | null>(null);

function checkDark(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

function getThemeConfig(isDark: boolean) {
  return {
    layout: {
      background: {
        type: ColorType.Solid,
        color: isDark ? '#000000' : '#ffffff',
      },
      textColor: isDark ? '#ffffff' : '#000000',
    },
    grid: {
      vertLines: { color: isDark ? '#18181b' : '#f4f4f5' },
      horzLines: { color: isDark ? '#18181b' : '#f4f4f5' },
    },
    crosshair: {
      vertLine: { color: isDark ? '#3f3f46' : '#d4d4d8' },
      horzLine: { color: isDark ? '#3f3f46' : '#d4d4d8' },
    },
    rightPriceScale: {
      borderColor: isDark ? '#27272a' : '#e4e4e7',
    },
    timeScale: {
      borderColor: isDark ? '#27272a' : '#e4e4e7',
      timeVisible: true,
      secondsVisible: false,
    },
  };
}

function formatData(rawData: CandlePoint[]) {
  if (!rawData || rawData.length === 0) return [];

  const converted = rawData.map((item) => {
    let t = item.time;
    if (typeof t === 'number' && t > 2000000000) {
      t = Math.floor(t / 1000);
    }
    const open = Number(item.open);
    const close = Number(item.close);
    const rawHigh = Number(item.high);
    const rawLow = Number(item.low);
    const high = Math.max(open, close, rawHigh);
    const low = Math.min(open, close, rawLow);

    return {
      time: t as Time,
      open,
      high,
      low,
      close,
      volume: item.volume,
    };
  });

  function parseTimeToMs(t: Time | number | string): number {
    if (typeof t === 'number') {
      return t > 2000000000 ? t : t * 1000;
    }
    if (typeof t === 'string') {
      return new Date(t).getTime();
    }
    if (typeof t === 'object' && t !== null && 'year' in t) {
      return new Date(t.year, t.month - 1, t.day).getTime();
    }
    return 0;
  }

  // Sort by time ascending
  converted.sort((a, b) => parseTimeToMs(a.time) - parseTimeToMs(b.time));

  // Deduplicate by time for lightweight-charts requirement
  const unique = new Map<string, (typeof converted)[0]>();
  for (const item of converted) {
    const key =
      typeof item.time === 'object' && item.time !== null && 'year' in item.time
        ? `${item.time.year}-${item.time.month}-${item.time.day}`
        : String(item.time);
    unique.set(key, item);
  }
  return Array.from(unique.values());
}

function formatPrice(val: number): string {
  if (val === 0) return '0.00';
  if (val < 0.0001) return val.toFixed(8);
  if (val < 1) return val.toFixed(6);
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function initChart() {
  if (!chartContainer.value) return;

  const isDark = checkDark();
  const width = chartContainer.value.clientWidth || 600;

  chart = createChart(chartContainer.value, {
    width,
    height: props.height,
    ...getThemeConfig(isDark),
  });

  series = chart.addSeries(CandlestickSeries, {
    upColor: '#10b981',
    downColor: '#f43f5e',
    borderVisible: true,
    borderUpColor: '#10b981',
    borderDownColor: '#f43f5e',
    wickVisible: true,
    wickUpColor: '#10b981',
    wickDownColor: '#f43f5e',
  });

  const formatted = formatData(props.data);
  series.setData(formatted);
  if (formatted.length > 0) {
    chart.timeScale().fitContent();
  }

  // Crosshair move handler
  chart.subscribeCrosshairMove((param) => {
    if (!param || !param.time || !series) {
      hoveredBar.value = null;
      return;
    }
    const dataAtTime = param.seriesData.get(series);
    if (dataAtTime && 'open' in dataAtTime) {
      hoveredBar.value = {
        time: String(param.time),
        open: dataAtTime.open,
        high: dataAtTime.high,
        low: dataAtTime.low,
        close: dataAtTime.close,
      };
    } else {
      hoveredBar.value = null;
    }
  });

  // ResizeObserver
  resizeObserver = new ResizeObserver((entries) => {
    if (!entries || entries.length === 0 || !chart) return;
    const newWidth = entries[0].contentRect.width;
    if (newWidth > 0) {
      chart.applyOptions({ width: newWidth });
    }
  });
  resizeObserver.observe(chartContainer.value);

  // MutationObserver for .dark on document.documentElement
  if (typeof document !== 'undefined') {
    themeObserver = new MutationObserver(() => {
      if (!chart) return;
      const currentDark = checkDark();
      chart.applyOptions(getThemeConfig(currentDark));
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }
}

watch(
  () => props.data,
  (newData) => {
    if (!series || !chart) return;
    const formatted = formatData(newData);
    series.setData(formatted);
    if (formatted.length > 0) {
      chart.timeScale().fitContent();
    }
  },
  { deep: true },
);

onMounted(() => {
  initChart();
});

onUnmounted(() => {
  if (themeObserver) {
    themeObserver.disconnect();
    themeObserver = null;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (chart) {
    chart.remove();
    chart = null;
    series = null;
  }
});
</script>

<template>
  <div class="w-full flex flex-col gap-2">
    <!-- Chart Header / Price Bar adhering to 2-color text system -->
    <div class="flex items-center justify-between text-xs font-mono px-1 min-h-[20px]">
      <div class="flex items-center gap-2">
        <span v-if="tokenSymbol" class="font-bold tracking-wider text-black dark:text-white">
          {{ tokenSymbol }}/USD
        </span>
        <div v-if="hoveredBar" class="flex items-center gap-2 text-black dark:text-white">
          <span
            >O:
            <span
              class="font-semibold"
              :class="hoveredBar.close >= hoveredBar.open ? 'text-emerald-500' : 'text-rose-500'"
              >{{ formatPrice(hoveredBar.open) }}</span
            ></span
          >
          <span
            >H:
            <span
              class="font-semibold"
              :class="hoveredBar.close >= hoveredBar.open ? 'text-emerald-500' : 'text-rose-500'"
              >{{ formatPrice(hoveredBar.high) }}</span
            ></span
          >
          <span
            >L:
            <span
              class="font-semibold"
              :class="hoveredBar.close >= hoveredBar.open ? 'text-emerald-500' : 'text-rose-500'"
              >{{ formatPrice(hoveredBar.low) }}</span
            ></span
          >
          <span
            >C:
            <span
              class="font-semibold"
              :class="hoveredBar.close >= hoveredBar.open ? 'text-emerald-500' : 'text-rose-500'"
              >{{ formatPrice(hoveredBar.close) }}</span
            ></span
          >
        </div>
      </div>
    </div>

    <!-- Chart Canvas Container -->
    <div
      ref="chartContainer"
      class="w-full rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black"
    />
  </div>
</template>
