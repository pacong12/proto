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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Refs / state
// ---------------------------------------------------------------------------

const chartContainer = ref<HTMLDivElement | null>(null);
let chart: IChartApi | null = null;
let candleSeries: ISeriesApi<'Candlestick'> | null = null;
let areaSeries: ISeriesApi<'Area'> | null = null;
let volumeSeries: ISeriesApi<'Histogram'> | null = null;
let resizeObserver: ResizeObserver | null = null;
let themeObserver: MutationObserver | null = null;

const chartMode = ref<'curve' | 'tradingview'>('curve');
const chartType = ref<'candles' | 'area'>('candles');
const isLogScale = ref(false);
const hoveredBar = ref<CandlePoint | null>(null);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checkDark(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

/**
 * Detect whether the entire dataset has zero price variance.
 * lightweight-charts collapses to a hairline when minValue === maxValue
 * across all bars; we need to know this upfront to apply autoscaleInfoProvider.
 */
function isDataFlat(data: ReturnType<typeof formatData>): boolean {
  if (data.length === 0) return true;
  const first = data[0].close;
  return data.every(
    (d) => d.open === first && d.high === first && d.low === first && d.close === first,
  );
}

const tradingViewUrl = computed(() => {
  const isDark = checkDark();
  const theme = isDark ? 'dark' : 'light';
  const sym = props.tokenSymbol?.toUpperCase() ?? '';
  let tvSym = 'BINANCE:ETHUSDT';
  if (sym === 'BTC' || sym === 'WBTC') tvSym = 'BINANCE:BTCUSDT';
  else if (sym === 'BNB') tvSym = 'BINANCE:BNBUSDT';
  return (
    `https://s.tradingview.com/widgetembed/?frameElementId=tv_embed` +
    `&symbol=${encodeURIComponent(tvSym)}` +
    `&interval=15` +
    `&hidesidetoolbar=0&symboledit=1&saveimage=1` +
    `&toolbarbg=${isDark ? '09090b' : 'ffffff'}` +
    `&studies=[]&theme=${theme}&style=1&timezone=Etc%2FUTC` +
    `&withdateranges=1&hideideas=1`
  );
});

// ---------------------------------------------------------------------------
// Theme configuration
// ---------------------------------------------------------------------------

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
      vertLines: { color: isDark ? 'rgba(39,39,42,0.4)' : 'rgba(244,244,245,0.8)' },
      horzLines: { color: isDark ? 'rgba(39,39,42,0.4)' : 'rgba(244,244,245,0.8)' },
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
      scaleMargins: { top: 0.12, bottom: 0.22 },
      mode: isLogScale.value ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    },
    timeScale: {
      borderColor: isDark ? '#27272a' : '#e4e4e7',
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 6,
      barSpacing: 8,
      minBarSpacing: 1,
    },
  };
}

// ---------------------------------------------------------------------------
// Data formatting
// Per lightweight-charts docs:
//   - time must be UTCTimestamp (integer seconds, strictly ascending, no dups)
//   - high >= max(open, close), low <= min(open, close)
//   - Never mutate raw OHLC values; use autoscaleInfoProvider for display margin
// ---------------------------------------------------------------------------

function formatData(rawData: CandlePoint[]) {
  if (!rawData || rawData.length === 0) return [];

  const converted = rawData.map((item) => {
    // Normalize timestamp: accept ms (>2e9) or seconds
    let tNum =
      typeof item.time === 'string' ? new Date(item.time).getTime() / 1000 : Number(item.time);
    if (tNum > 2_000_000_000) tNum = tNum / 1000;
    const t = Math.floor(tNum);

    const open = Number(item.open);
    const close = Number(item.close);
    const rawHigh = Number(item.high);
    const rawLow = Number(item.low);

    // Enforce OHLC invariant: high >= max(o,c), low <= min(o,c)
    // Do NOT add synthetic wicks — pass raw values as-is
    const high = Math.max(open, close, rawHigh);
    const low = Math.min(open, close, rawLow);

    return {
      time: t as Time,
      open,
      high,
      low,
      close,
      volume: Number(item.volume ?? 0),
    };
  });

  // Sort strictly ascending by integer seconds timestamp
  converted.sort((a, b) => Number(a.time) - Number(b.time));

  // Deduplicate: keep last entry for each timestamp (latest update wins)
  const seen = new Map<number, (typeof converted)[0]>();
  for (const bar of converted) {
    seen.set(Number(bar.time), bar);
  }

  return Array.from(seen.values()).sort((a, b) => Number(a.time) - Number(b.time));
}

// ---------------------------------------------------------------------------
// autoscaleInfoProvider factory
// Per docs: return null to use default; return AutoscaleInfo to override.
// We only intervene when the price range is zero (flat dataset).
// ---------------------------------------------------------------------------

function makeAutoscaleProvider(flatPrice: number | null) {
  return (original: () => AutoscaleInfo | null): AutoscaleInfo | null => {
    const res = original();
    if (!res || !res.priceRange) return res;
    const { minValue, maxValue } = res.priceRange;
    if (minValue === maxValue) {
      const val = flatPrice ?? minValue;
      // Use 5 % band around the flat price for readable scale
      const margin = val > 0 ? val * 0.05 : 0.000001;
      return {
        priceRange: {
          minValue: Math.max(0, val - margin),
          maxValue: val + margin,
        },
        margins: res.margins,
      };
    }
    return res;
  };
}

// ---------------------------------------------------------------------------
// Formatters for the OHLCV toolbar
// ---------------------------------------------------------------------------

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
  return val.toFixed(4);
}

// ---------------------------------------------------------------------------
// Computed: active toolbar bar (hovered or last)
// ---------------------------------------------------------------------------

const activeBar = computed<CandlePoint | null>(() => {
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

// Whether all candles share the same price (informational label)
const dataIsFlat = computed(() => isDataFlat(formatData(props.data)));

// ---------------------------------------------------------------------------
// Chart initialisation
// ---------------------------------------------------------------------------

function destroyChart() {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (themeObserver) {
    themeObserver.disconnect();
    themeObserver = null;
  }
  if (chart) {
    chart.remove();
    chart = null;
    candleSeries = null;
    areaSeries = null;
    volumeSeries = null;
  }
}

function initChart() {
  if (!chartContainer.value || chartMode.value !== 'curve') return;
  destroyChart();

  const isDark = checkDark();
  const width = chartContainer.value.clientWidth || 700;
  const formatted = formatData(props.data);
  const flatPrice = dataIsFlat.value && formatted.length > 0 ? formatted[0].close : null;

  chart = createChart(chartContainer.value, {
    width,
    height: props.height,
    ...getThemeConfig(isDark),
    // Disable built-in kinetic scroll so the series autoscale can breathe
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
    handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
  });

  // 1. Volume histogram — overlaid on its own scale (bottom 22%)
  volumeSeries = chart.addSeries(HistogramSeries, {
    priceFormat: { type: 'volume' },
    priceScaleId: 'vol',
  });
  volumeSeries.priceScale().applyOptions({
    scaleMargins: { top: 0.78, bottom: 0 },
  });

  const autoscaleProvider = makeAutoscaleProvider(flatPrice);

  // 2. Main price series
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
      priceFormat: { type: 'price', precision: 8, minMove: 0.00000001 },
      autoscaleInfoProvider: autoscaleProvider,
    });
    candleSeries.setData(formatted);
  } else {
    areaSeries = chart.addSeries(AreaSeries, {
      topColor: 'rgba(16,185,129,0.28)',
      bottomColor: 'rgba(16,185,129,0.02)',
      lineColor: '#10b981',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 8, minMove: 0.00000001 },
      autoscaleInfoProvider: autoscaleProvider,
    });
    areaSeries.setData(formatted.map((d) => ({ time: d.time, value: d.close })));
  }

  // 3. Volume data
  const volData = formatted.map((d) => ({
    time: d.time,
    value: d.volume,
    color: d.close >= d.open ? 'rgba(16,185,129,0.45)' : 'rgba(244,63,94,0.45)',
  }));
  volumeSeries.setData(volData);

  if (formatted.length > 0) {
    chart.timeScale().fitContent();
  }

  // 4. Crosshair move — update toolbar
  chart.subscribeCrosshairMove((param) => {
    if (!param || !param.time) {
      hoveredBar.value = null;
      return;
    }
    const activeSeries = candleSeries ?? areaSeries;
    if (!activeSeries) return;

    const barData = param.seriesData.get(activeSeries);
    const volAtTime = volumeSeries ? param.seriesData.get(volumeSeries) : null;
    const vol = volAtTime && 'value' in volAtTime ? Number(volAtTime.value) : undefined;

    if (barData && 'open' in barData) {
      hoveredBar.value = {
        time: String(param.time),
        open: Number(barData.open),
        high: Number(barData.high),
        low: Number(barData.low),
        close: Number(barData.close),
        volume: vol,
      };
    } else if (barData && 'value' in barData) {
      const v = Number(barData.value);
      hoveredBar.value = {
        time: String(param.time),
        open: v,
        high: v,
        low: v,
        close: v,
        volume: vol,
      };
    } else {
      hoveredBar.value = null;
    }
  });

  // 5. ResizeObserver — responsive width
  resizeObserver = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect.width;
    if (w && w > 0 && chart) chart.applyOptions({ width: w });
  });
  resizeObserver.observe(chartContainer.value);

  // 6. MutationObserver — dark mode switch
  if (typeof document !== 'undefined') {
    themeObserver = new MutationObserver(() => {
      if (!chart) return;
      chart.applyOptions(getThemeConfig(checkDark()));
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

function setChartMode(mode: 'curve' | 'tradingview') {
  chartMode.value = mode;
  if (mode === 'curve') setTimeout(() => initChart(), 50);
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
  if (chart) chart.timeScale().fitContent();
}

// ---------------------------------------------------------------------------
// Watcher — update series data when prop changes
// ---------------------------------------------------------------------------

watch(
  () => props.data,
  (newData, oldData) => {
    if (!chart) {
      if (chartContainer.value) initChart();
      return;
    }

    const formatted = formatData(newData);
    const flatPrice = isDataFlat(formatted) && formatted.length > 0 ? formatted[0].close : null;

    if (candleSeries) {
      // Re-apply autoscaleInfoProvider with updated flat-price if needed
      candleSeries.applyOptions({ autoscaleInfoProvider: makeAutoscaleProvider(flatPrice) });
      candleSeries.setData(formatted);
    } else if (areaSeries) {
      areaSeries.applyOptions({ autoscaleInfoProvider: makeAutoscaleProvider(flatPrice) });
      areaSeries.setData(formatted.map((d) => ({ time: d.time, value: d.close })));
    }

    if (volumeSeries) {
      volumeSeries.setData(
        formatted.map((d) => ({
          time: d.time,
          value: d.volume,
          color: d.close >= d.open ? 'rgba(16,185,129,0.45)' : 'rgba(244,63,94,0.45)',
        })),
      );
    }

    const isMajorUpdate = !oldData || Math.abs(newData.length - oldData.length) > 3;
    if (isMajorUpdate && formatted.length > 0) chart.timeScale().fitContent();
  },
  { deep: true },
);

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(() => initChart());
onUnmounted(() => destroyChart());
</script>

<template>
  <div class="w-full flex flex-col gap-2">
    <!-- OHLCV Professional Toolbar -->
    <div
      class="flex flex-wrap items-center justify-between gap-2 text-xs font-mono px-2 py-1.5 rounded-lg bg-zinc-50/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800"
    >
      <!-- Left: Symbol + OHLCV live bar -->
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
            class="px-1.5 rounded font-bold text-[10px]"
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

        <!-- Flat-data informational label -->
        <span
          v-if="chartMode === 'curve' && dataIsFlat && (data?.length ?? 0) > 1"
          class="text-[10px] font-mono text-zinc-400 dark:text-zinc-600 ml-1 italic"
        >
          no price movement yet
        </span>
      </div>

      <!-- Right: Mode selector + chart controls -->
      <div class="flex items-center gap-1.5 shrink-0 ml-auto flex-wrap">
        <!-- Bonding Curve vs TradingView toggle -->
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
          <!-- Candles toggle -->
          <button
            type="button"
            class="p-1 rounded text-zinc-500 hover:text-black dark:hover:text-white transition cursor-pointer"
            :class="
              chartType === 'candles'
                ? 'bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white'
                : ''
            "
            title="Candlestick chart"
            @click="toggleChartType('candles')"
          >
            <CandlestickChart class="w-3.5 h-3.5" />
          </button>

          <!-- Area toggle -->
          <button
            type="button"
            class="p-1 rounded text-zinc-500 hover:text-black dark:hover:text-white transition cursor-pointer"
            :class="
              chartType === 'area' ? 'bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white' : ''
            "
            title="Area chart"
            @click="toggleChartType('area')"
          >
            <TrendingUp class="w-3.5 h-3.5" />
          </button>

          <span class="w-px h-3.5 bg-zinc-300 dark:bg-zinc-700 mx-0.5" />

          <!-- LOG / LIN -->
          <button
            type="button"
            class="px-1.5 py-0.5 text-[10px] font-bold rounded text-zinc-500 hover:text-black dark:hover:text-white transition cursor-pointer"
            :class="isLogScale ? 'bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white' : ''"
            title="Toggle log / linear scale"
            @click="toggleLogScale"
          >
            {{ isLogScale ? 'LOG' : 'LIN' }}
          </button>

          <!-- Fit content -->
          <button
            type="button"
            class="p-1 rounded text-zinc-500 hover:text-black dark:hover:text-white transition cursor-pointer"
            title="Fit chart to content"
            @click="fitContent"
          >
            <Maximize2 class="w-3.5 h-3.5" />
          </button>
        </template>
      </div>
    </div>

    <!-- Bonding Curve chart canvas (lightweight-charts) -->
    <div
      v-show="chartMode === 'curve'"
      ref="chartContainer"
      class="w-full rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] shadow-xs"
      :style="{ minHeight: `${props.height}px` }"
    />

    <!-- TradingView iframe embed -->
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
