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
  type AutoscaleInfo,
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
  tokenAddress?: string;
  height?: number;
}

const props = withDefaults(defineProps<Props>(), {
  tokenSymbol: '',
  tokenAddress: '',
  height: 420,
});

const chartContainer = ref<HTMLDivElement | null>(null);
let chart: IChartApi | null = null;
let candleSeries: ISeriesApi<'Candlestick'> | null = null;
let areaSeries: ISeriesApi<'Area'> | null = null;
let volumeSeries: ISeriesApi<'Histogram'> | null = null;
let resizeObserver: ResizeObserver | null = null;
let themeObserver: MutationObserver | null = null;

// User Interactive Chart Controls (TradingView Style)
const chartMode = ref<'curve' | 'tradingview'>('curve');
const chartType = ref<'candles' | 'area'>('candles');
const isLogScale = ref(false);
const hoveredBar = ref<CandlePoint | null>(null);

function checkDark(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

const tradingViewUrl = computed(() => {
  const isDark = checkDark();
  const theme = isDark ? 'dark' : 'light';
  const sym = props.tokenSymbol?.toUpperCase();
  const tvSymbol =
    sym === 'PROTO' || sym === 'USDC'
      ? 'BINANCE:USDCUSDT'
      : sym === 'ETH' || sym === 'WETH'
        ? 'BINANCE:ETHUSDT'
        : 'BINANCE:ETHUSDT';

  return `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_embed&symbol=${encodeURIComponent(tvSymbol)}&interval=15&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=${isDark ? '09090b' : 'ffffff'}&studies=[]&theme=${theme}&style=1&timezone=Etc%2FUTC&withdateranges=1&hideideas=1`;
});

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
    const rawHigh = Number(item.high);
    const rawLow = Number(item.low);

    // Strictly standard OHLC bounds — never inject artificial wicks
    const high = Math.max(open, close, rawHigh);
    const low = Math.min(open, close, rawLow);

    return {
      time: Math.floor(Number(t)) as Time,
      open,
      high,
      low,
      close,
      volume: Number(item.volume ?? 0),
    };
  });

  // Sort strictly ascending by timestamp
  converted.sort((a, b) => Number(a.time) - Number(b.time));

  // Deduplicate by integer seconds timestamp for lightweight-charts
  const unique = new Map<number, (typeof converted)[0]>();
  for (const item of converted) {
    unique.set(Number(item.time), item);
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
  if (!chartContainer.value || chartMode.value !== 'curve') return;

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
    priceScaleId: '', // Overlay inside the chart pane
  });

  volumeSeries.priceScale().applyOptions({
    scaleMargins: {
      top: 0.8,
      bottom: 0,
    },
  });

  // 2. Primary Price Series (Candles or Area) with TradingView autoscaleInfoProvider
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
      autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
        const res = original();
        if (res !== null && res.priceRange !== null) {
          // If flat range (min === max), expand 5% margin so candle is cleanly centered
          if (res.priceRange.minValue === res.priceRange.maxValue) {
            const val = res.priceRange.minValue;
            const margin = val > 0 ? val * 0.05 : 0.000001;
            return {
              priceRange: {
                minValue: Math.max(0, val - margin),
                maxValue: val + margin,
              },
              margins: res.margins,
            };
          }
        }
        return res;
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
      autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
        const res = original();
        if (res !== null && res.priceRange !== null) {
          if (res.priceRange.minValue === res.priceRange.maxValue) {
            const val = res.priceRange.minValue;
            const margin = val > 0 ? val * 0.05 : 0.000001;
            return {
              priceRange: {
                minValue: Math.max(0, val - margin),
                maxValue: val + margin,
              },
              margins: res.margins,
            };
          }
        }
        return res;
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

function setChartMode(mode: 'curve' | 'tradingview') {
  chartMode.value = mode;
  if (mode === 'curve') {
    setTimeout(() => {
      initChart();
    }, 50);
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
  (newData, oldData) => {
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

    const isMajorChange = !oldData || Math.abs(newData.length - oldData.length) > 5;
    if (formatted.length > 0 && isMajorChange) {
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

      <!-- Right: Chart Mode (Curve / TradingView) + Chart Controls -->
      <div class="flex items-center gap-1.5 shrink-0 ml-auto flex-wrap">
        <!-- Mode Switcher: Curve vs TradingView -->
        <div
          class="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5 text-[10px] font-bold bg-zinc-100 dark:bg-zinc-950"
        >
          <button
            type="button"
            class="px-2 py-0.5 rounded transition cursor-pointer"
            :class="
              chartMode === 'curve'
                ? 'bg-emerald-500 text-black'
                : 'text-zinc-500 hover:text-black dark:hover:text-white'
            "
            @click="setChartMode('curve')"
          >
            Bonding Curve
          </button>
          <button
            type="button"
            class="px-2 py-0.5 rounded transition cursor-pointer"
            :class="
              chartMode === 'tradingview'
                ? 'bg-emerald-500 text-black'
                : 'text-zinc-500 hover:text-black dark:hover:text-white'
            "
            @click="setChartMode('tradingview')"
          >
            TradingView
          </button>
        </div>

        <template v-if="chartMode === 'curve'">
          <button
            type="button"
            class="p-1 rounded text-zinc-500 hover:text-black dark:hover:text-white transition cursor-pointer"
            :class="
              chartType === 'candles'
                ? 'bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white'
                : ''
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
        </template>
      </div>
    </div>

    <!-- Chart Canvas Container (Native Bonding Curve Lightweight Charts) -->
    <div
      v-show="chartMode === 'curve'"
      ref="chartContainer"
      class="w-full rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] shadow-xs"
      :style="{ minHeight: `${props.height}px` }"
    />

    <!-- TradingView Iframe Widget Embed (Full Web TradingView Suite) -->
    <div
      v-if="chartMode === 'tradingview'"
      class="w-full rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] shadow-xs"
      :style="{ height: `${props.height}px` }"
    >
      <iframe
        :src="tradingViewUrl"
        class="w-full h-full border-0"
        allowtransparency="true"
        scrolling="no"
      />
    </div>
  </div>
</template>
