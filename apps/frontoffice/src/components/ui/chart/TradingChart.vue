<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  AreaSeries,
  PriceScaleMode,
  CrosshairMode,
  LineStyle,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import { CandlestickChart, TrendingUp, Maximize2 } from 'lucide-vue-next';

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
  height: 400,
});

const chartContainer = ref<HTMLDivElement | null>(null);
let chart: IChartApi | null = null;
let candleSeries: ISeriesApi<'Candlestick'> | null = null;
let areaSeries: ISeriesApi<'Area'> | null = null;
let volumeSeries: ISeriesApi<'Histogram'> | null = null;
let resizeObserver: ResizeObserver | null = null;
let themeObserver: MutationObserver | null = null;

// User Interactive Chart Controls (TradingView Style)
const chartType = ref<'candles' | 'area'>('candles');
const isLogScale = ref(false);
const hoveredBar = ref<CandlePoint | null>(null);

function checkDark(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

function getThemeConfig(isDark: boolean) {
  return {
    layout: {
      background: {
        type: ColorType.Solid,
        color: isDark ? '#09090b' : '#ffffff',
      },
      textColor: isDark ? '#a1a1aa' : '#52525b',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    },
    grid: {
      vertLines: { color: isDark ? 'rgba(39, 39, 42, 0.4)' : 'rgba(244, 244, 245, 0.8)' },
      horzLines: { color: isDark ? 'rgba(39, 39, 42, 0.4)' : 'rgba(244, 244, 245, 0.8)' },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: isDark ? '#71717a' : '#a1a1aa',
        width: 1 as const,
        style: LineStyle.Dashed,
        labelBackgroundColor: isDark ? '#27272a' : '#e4e4e7',
      },
      horzLine: {
        color: isDark ? '#71717a' : '#a1a1aa',
        width: 1 as const,
        style: LineStyle.Dashed,
        labelBackgroundColor: isDark ? '#27272a' : '#e4e4e7',
      },
    },
    rightPriceScale: {
      borderColor: isDark ? '#27272a' : '#e4e4e7',
      scaleMargins: {
        top: 0.1,
        bottom: 0.2, // Leave bottom 20% for the volume histogram
      },
      mode: isLogScale.value ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    },
    timeScale: {
      borderColor: isDark ? '#27272a' : '#e4e4e7',
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 6,
      barSpacing: 12,
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
    let rawHigh = Number(item.high);
    let rawLow = Number(item.low);

    // If candle has 0 range (e.g. single trade or flat genesis), add a micro 0.05% visual range so candle is visible
    if (rawHigh === rawLow && rawHigh > 0) {
      rawHigh = rawHigh * 1.0005;
      rawLow = rawLow * 0.9995;
    }

    const high = Math.max(open, close, rawHigh);
    const low = Math.min(open, close, rawLow);

    return {
      time: t as Time,
      open,
      high,
      low,
      close,
      volume: item.volume ?? 0,
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
  if (isNaN(val) || val === 0) return '0.00';
  if (val < 0.0001) return val.toFixed(8);
  if (val < 1) return val.toFixed(6);
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function formatVolume(val: number): string {
  if (isNaN(val) || val === 0) return '0';
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(2)}K`;
  return val.toFixed(2);
}

// Active display bar (hovered candle or fallback to latest candle)
const activeBar = computed(() => {
  if (hoveredBar.value) return hoveredBar.value;
  const formatted = formatData(props.data);
  if (formatted.length > 0) {
    const last = formatted[formatted.length - 1];
    return {
      time: String(last.time),
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
      volume: last.volume,
    };
  }
  return null;
});

const barChangePercent = computed(() => {
  if (!activeBar.value || activeBar.value.open === 0) return 0;
  return ((activeBar.value.close - activeBar.value.open) / activeBar.value.open) * 100;
});

function initChart() {
  if (!chartContainer.value) return;

  if (chart) {
    chart.remove();
    chart = null;
    candleSeries = null;
    areaSeries = null;
    volumeSeries = null;
  }

  const isDark = checkDark();
  const width = chartContainer.value.clientWidth || 600;

  chart = createChart(chartContainer.value, {
    width,
    height: props.height,
    ...getThemeConfig(isDark),
  });

  const formatted = formatData(props.data);

  // 1. Volume Histogram Series (Bottom 20% overlay)
  volumeSeries = chart.addSeries(HistogramSeries, {
    priceFormat: {
      type: 'volume',
    },
    priceScaleId: '', // Overlay as secondary scale inside chart
  });

  volumeSeries.priceScale().applyOptions({
    scaleMargins: {
      top: 0.8,
      bottom: 0,
    },
  });

  // 2. Primary Price Series (Candles or Area)
  if (chartType.value === 'candles') {
    candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: true,
      borderUpColor: '#10b981',
      borderDownColor: '#f43f5e',
      wickVisible: true,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
      priceFormat: {
        type: 'price',
        precision: 8,
        minMove: 0.00000001,
      },
    });
    candleSeries.setData(formatted);
  } else {
    areaSeries = chart.addSeries(AreaSeries, {
      topColor: 'rgba(16, 185, 129, 0.28)',
      bottomColor: 'rgba(16, 185, 129, 0.02)',
      lineColor: '#10b981',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 8,
        minMove: 0.00000001,
      },
    });
    const areaData = formatted.map((d) => ({ time: d.time, value: d.close }));
    areaSeries.setData(areaData);
  }

  // 3. Set Volume Data
  const volumeData = formatted.map((d) => ({
    time: d.time,
    value: d.volume,
    color: d.close >= d.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
  }));
  volumeSeries.setData(volumeData);

  if (formatted.length > 0) {
    chart.timeScale().fitContent();
  }

  // Crosshair move handler
  chart.subscribeCrosshairMove((param) => {
    if (!param || !param.time) {
      hoveredBar.value = null;
      return;
    }
    const currentActiveSeries = candleSeries || areaSeries;
    if (!currentActiveSeries) return;

    const dataAtTime = param.seriesData.get(currentActiveSeries);
    const volAtTime = volumeSeries ? param.seriesData.get(volumeSeries) : null;
    const vol = volAtTime && 'value' in volAtTime ? Number(volAtTime.value) : undefined;

    if (dataAtTime && 'open' in dataAtTime) {
      hoveredBar.value = {
        time: String(param.time),
        open: Number(dataAtTime.open),
        high: Number(dataAtTime.high),
        low: Number(dataAtTime.low),
        close: Number(dataAtTime.close),
        volume: vol,
      };
    } else if (dataAtTime && 'value' in dataAtTime) {
      const val = Number(dataAtTime.value);
      hoveredBar.value = {
        time: String(param.time),
        open: val,
        high: val,
        low: val,
        close: val,
        volume: vol,
      };
    } else {
      hoveredBar.value = null;
    }
  });

  // ResizeObserver for responsive width
  resizeObserver = new ResizeObserver((entries) => {
    if (!entries || entries.length === 0 || !chart) return;
    const newWidth = entries[0].contentRect.width;
    if (newWidth > 0) {
      chart.applyOptions({ width: newWidth });
    }
  });
  resizeObserver.observe(chartContainer.value);

  // Theme observer for dark mode switching
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

function toggleChartType(type: 'candles' | 'area') {
  if (chartType.value === type) return;
  chartType.value = type;
  initChart();
}

function toggleLogScale() {
  isLogScale.value = !isLogScale.value;
  if (chart) {
    chart.priceScale('right').applyOptions({
      mode: isLogScale.value ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    });
  }
}

function fitContent() {
  if (chart) {
    chart.timeScale().fitContent();
  }
}

watch(
  () => props.data,
  (newData) => {
    if (!chart) {
      if (chartContainer.value) initChart();
      return;
    }
    const formatted = formatData(newData);

    if (candleSeries) {
      candleSeries.setData(formatted);
    } else if (areaSeries) {
      areaSeries.setData(formatted.map((d) => ({ time: d.time, value: d.close })));
    }

    if (volumeSeries) {
      const volumeData = formatted.map((d) => ({
        time: d.time,
        value: d.volume,
        color: d.close >= d.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
      }));
      volumeSeries.setData(volumeData);
    }

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
    candleSeries = null;
    areaSeries = null;
    volumeSeries = null;
  }
});
</script>

<template>
  <div class="w-full flex flex-col gap-2">
    <!-- TradingView Professional Metric Toolbar -->
    <div
      class="flex flex-wrap items-center justify-between gap-2 text-xs font-mono px-2 py-1.5 rounded-lg bg-zinc-50/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800"
    >
      <!-- Left: Symbol + Live OHLCV Bar -->
      <div class="flex items-center gap-3 flex-wrap min-w-0">
        <span
          v-if="tokenSymbol"
          class="font-extrabold tracking-wider text-black dark:text-white px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-[11px]"
        >
          {{ tokenSymbol }}/USD
        </span>

        <div v-if="activeBar" class="flex items-center gap-2.5 text-[11px] flex-wrap">
          <span class="text-zinc-500 dark:text-zinc-400">
            O:
            <span class="font-bold text-black dark:text-white">{{
              formatPrice(activeBar.open)
            }}</span>
          </span>
          <span class="text-zinc-500 dark:text-zinc-400">
            H:
            <span class="font-bold text-black dark:text-white">{{
              formatPrice(activeBar.high)
            }}</span>
          </span>
          <span class="text-zinc-500 dark:text-zinc-400">
            L:
            <span class="font-bold text-black dark:text-white">{{
              formatPrice(activeBar.low)
            }}</span>
          </span>
          <span class="text-zinc-500 dark:text-zinc-400">
            C:
            <span
              class="font-bold"
              :class="activeBar.close >= activeBar.open ? 'text-emerald-500' : 'text-rose-500'"
            >
              {{ formatPrice(activeBar.close) }}
            </span>
          </span>
          <span
            class="px-1.5 py-0.2 rounded font-bold text-[10px]"
            :class="
              barChangePercent >= 0
                ? 'bg-emerald-500/15 text-emerald-500'
                : 'bg-rose-500/15 text-rose-500'
            "
          >
            {{ barChangePercent >= 0 ? '+' : '' }}{{ barChangePercent.toFixed(2) }}%
          </span>
          <span v-if="activeBar.volume !== undefined" class="text-zinc-500 dark:text-zinc-400">
            Vol:
            <span class="font-bold text-black dark:text-white"
              >${{ formatVolume(activeBar.volume) }}</span
            >
          </span>
        </div>
      </div>

      <!-- Right: Chart Control Actions (Candles/Area, Log/Linear, Fit) -->
      <div class="flex items-center gap-1 shrink-0 ml-auto">
        <button
          type="button"
          class="p-1 rounded text-zinc-500 hover:text-black dark:hover:text-white transition cursor-pointer"
          :class="
            chartType === 'candles' ? 'bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white' : ''
          "
          title="Candlesticks"
          @click="toggleChartType('candles')"
        >
          <CandlestickChart class="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          class="p-1 rounded text-zinc-500 hover:text-black dark:hover:text-white transition cursor-pointer"
          :class="
            chartType === 'area' ? 'bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white' : ''
          "
          title="Area Line"
          @click="toggleChartType('area')"
        >
          <TrendingUp class="w-3.5 h-3.5" />
        </button>

        <span class="w-px h-3.5 bg-zinc-300 dark:bg-zinc-700 mx-0.5" />

        <button
          type="button"
          class="px-1.5 py-0.5 text-[10px] font-bold rounded text-zinc-500 hover:text-black dark:hover:text-white transition cursor-pointer"
          :class="isLogScale ? 'bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white' : ''"
          title="Toggle Logarithmic / Linear Scale"
          @click="toggleLogScale"
        >
          {{ isLogScale ? 'LOG' : 'LIN' }}
        </button>

        <button
          type="button"
          class="p-1 rounded text-zinc-500 hover:text-black dark:hover:text-white transition cursor-pointer"
          title="Fit Chart to Content"
          @click="fitContent"
        >
          <Maximize2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Chart Canvas Container -->
    <div
      ref="chartContainer"
      class="w-full rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] shadow-xs"
      :style="{ minHeight: `${props.height}px` }"
    />
  </div>
</template>
