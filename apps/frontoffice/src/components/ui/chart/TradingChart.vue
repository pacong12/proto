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
import ShadcnTradingLineChart from './ShadcnTradingLineChart.vue';

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
  resolution?: number;
  chartMode?: 'price' | 'mcap';
  currencyMode?: 'usd' | 'native';
  nativeSymbol?: string;
  nativeQuotePrice?: number;
  totalSupply?: number;
}

const props = withDefaults(defineProps<Props>(), {
  tokenSymbol: '',
  tokenAddress: '',
  height: 420,
  resolution: 60,
  chartMode: 'price',
  currencyMode: 'usd',
  nativeSymbol: 'ETH',
  nativeQuotePrice: 2700,
  totalSupply: 1_000_000_000,
});

const emit = defineEmits<{
  (e: 'update:chartMode', val: 'price' | 'mcap'): void;
  (e: 'update:currencyMode', val: 'usd' | 'native'): void;
}>();

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

const chartType = ref<'candles' | 'area'>('candles');
const isLogScale = ref(false);
const hoveredBar = ref<CandlePoint | null>(null);

const activeChartMode = ref<'price' | 'mcap'>(props.chartMode);
const activeCurrencyMode = ref<'usd' | 'native'>(props.currencyMode);

watch(
  () => props.chartMode,
  (val) => {
    if (val && val !== activeChartMode.value) {
      activeChartMode.value = val;
      initChart();
    }
  },
);

watch(
  () => props.currencyMode,
  (val) => {
    if (val && val !== activeCurrencyMode.value) {
      activeCurrencyMode.value = val;
      initChart();
    }
  },
);

function setChartMode(mode: 'price' | 'mcap') {
  if (activeChartMode.value === mode) return;
  activeChartMode.value = mode;
  emit('update:chartMode', mode);
  initChart();
}

function setCurrencyMode(mode: 'usd' | 'native') {
  if (activeCurrencyMode.value === mode) return;
  activeCurrencyMode.value = mode;
  emit('update:currencyMode', mode);
  initChart();
}

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

// ---------------------------------------------------------------------------
// Theme configuration
// ---------------------------------------------------------------------------

function getCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
}

function getThemeConfig(isDark: boolean) {
  const bg = getCssVar('--background', isDark ? '#09090b' : '#ffffff');
  const border = getCssVar('--border', isDark ? '#27272a' : '#e4e4e7');
  const textMuted = getCssVar('--muted-foreground', isDark ? '#a1a1aa' : '#52525b');

  return {
    layout: {
      background: {
        type: ColorType.Solid,
        color: bg,
      },
      textColor: textMuted,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    },
    grid: {
      vertLines: { color: isDark ? 'rgba(39,39,42,0.4)' : 'rgba(244,244,245,0.8)' },
      horzLines: { color: isDark ? 'rgba(39,39,42,0.4)' : 'rgba(244,244,245,0.8)' },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: textMuted,
        width: 1 as const,
        style: LineStyle.Dashed,
        labelBackgroundColor: border,
      },
      horzLine: {
        color: textMuted,
        width: 1 as const,
        style: LineStyle.Dashed,
        labelBackgroundColor: border,
      },
    },
    rightPriceScale: {
      borderColor: border,
      scaleMargins: { top: 0.12, bottom: 0.22 },
      mode: isLogScale.value ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    },
    timeScale: {
      borderColor: border,
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 12,
      barSpacing: 22,
      minBarSpacing: 6,
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

function getModeMultiplier(): number {
  if (activeChartMode.value === 'mcap') {
    const supply = props.totalSupply > 0 ? props.totalSupply : 1_000_000_000;
    return supply;
  }
  if (activeCurrencyMode.value === 'native') {
    const rate = props.nativeQuotePrice > 0 ? props.nativeQuotePrice : 2700;
    return 1 / rate;
  }
  return 1;
}

function formatData(rawData: CandlePoint[]) {
  if (!rawData || rawData.length === 0) return [];
  const multiplier = getModeMultiplier();

  const converted = rawData.map((item) => {
    // Normalize timestamp: accept ms (>2e9) or seconds
    let tNum =
      typeof item.time === 'string' ? new Date(item.time).getTime() / 1000 : Number(item.time);
    if (tNum > 2_000_000_000) tNum = tNum / 1000;
    const t = Math.floor(tNum);

    const open = Number(item.open) * multiplier;
    const close = Number(item.close) * multiplier;
    const rawHigh = Number(item.high) * multiplier;
    const rawLow = Number(item.low) * multiplier;

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
  if (activeChartMode.value === 'mcap') {
    if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(2)}K`;
    return `$${val.toFixed(2)}`;
  }
  if (activeCurrencyMode.value === 'native') {
    if (val < 0.00000001) return `${val.toFixed(11)} ${props.nativeSymbol}`;
    if (val < 0.0001) return `${val.toFixed(8)} ${props.nativeSymbol}`;
    if (val < 1) return `${val.toFixed(6)} ${props.nativeSymbol}`;
    return `${val.toFixed(4)} ${props.nativeSymbol}`;
  }
  if (val < 0.00000001) return `$${val.toFixed(11)}`;
  if (val < 0.0001) return `$${val.toFixed(8)}`;
  if (val < 1) return `$${val.toFixed(6)}`;
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function getPriceFormatOptions(data: Array<{ close: number }>) {
  if (activeChartMode.value === 'mcap') {
    return {
      type: 'custom' as const,
      formatter: (val: number) => {
        if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
        if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
        if (val >= 1_000) return `$${(val / 1_000).toFixed(2)}K`;
        return `$${val.toFixed(2)}`;
      },
      minMove: 0.01,
    };
  }
  if (activeCurrencyMode.value === 'native') {
    return {
      type: 'custom' as const,
      formatter: (val: number) => {
        if (val < 0.00000001) return val.toFixed(10);
        if (val < 0.0001) return val.toFixed(8);
        if (val < 1) return val.toFixed(6);
        return val.toFixed(4);
      },
      minMove: 0.0000000001,
    };
  }
  return {
    type: 'custom' as const,
    formatter: (val: number) => {
      if (val === 0) return '$0';
      if (val < 0.00000001) return `$${val.toFixed(10)}`;
      if (val < 0.0001) return `$${val.toFixed(8)}`;
      if (val < 1) return `$${val.toFixed(6)}`;
      return `$${val.toFixed(2)}`;
    },
    minMove: 0.00000001,
  };
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
// Standard Financial Chart Colors (Retrieved dynamically from CSS variables)
const BULLISH_GREEN = getCssVar('--bullish', '#22c55e');
const BEARISH_RED = getCssVar('--bearish', '#ef4444');

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
  if (!chartContainer.value) return;
  destroyChart();

  const isDark = checkDark();
  const width = chartContainer.value.clientWidth || 700;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const responsiveHeight = isMobile ? Math.min(props.height, 320) : props.height;
  const formatted = formatData(props.data);
  const flatPrice = dataIsFlat.value && formatted.length > 0 ? formatted[0].close : null;

  chart = createChart(chartContainer.value, {
    width,
    height: responsiveHeight,
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
  const upColor = BULLISH_GREEN;
  const downColor = BEARISH_RED;

  if (chartType.value === 'candles') {
    candleSeries = chart.addSeries(CandlestickSeries, {
      upColor,
      downColor,
      borderVisible: true,
      borderUpColor: upColor,
      borderDownColor: downColor,
      wickVisible: true,
      wickUpColor: upColor,
      wickDownColor: downColor,
      priceFormat: getPriceFormatOptions(formatted),
      autoscaleInfoProvider: autoscaleProvider,
    });
    candleSeries.setData(formatted);
  } else {
    areaSeries = chart.addSeries(AreaSeries, {
      topColor: 'rgba(34, 197, 94, 0.25)',
      bottomColor: 'rgba(34, 197, 94, 0.01)',
      lineColor: BULLISH_GREEN,
      lineWidth: 2,
      priceFormat: getPriceFormatOptions(formatted),
      autoscaleInfoProvider: autoscaleProvider,
    });
    areaSeries.setData(formatted.map((d) => ({ time: d.time, value: d.close })));
  }

  // 3. Volume data (Green for bullish bars, Red for bearish bars)
  const volData = formatted.map((d) => ({
    time: d.time,
    value: d.volume,
    color: d.close >= d.open ? 'rgba(34, 197, 94, 0.55)' : 'rgba(239, 68, 68, 0.55)',
  }));
  volumeSeries.setData(volData);

  if (formatted.length > 0) {
    applyOptimalVisibleRange(formatted.length);
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

  // 5. ResizeObserver — responsive width and height
  resizeObserver = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect.width;
    if (w && w > 0 && chart) {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
      const h = isMobile ? Math.min(props.height, 320) : props.height;
      chart.applyOptions({ width: w, height: h });
    }
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

function onShadcnBarHover(bar: CandlePoint | null) {
  hoveredBar.value = bar;
}

function toggleChartType(type: 'candles' | 'area') {
  if (chartType.value === type) return;
  chartType.value = type;
  if (type === 'candles') {
    setTimeout(() => {
      initChart();
    }, 20);
  }
}

function toggleLogScale() {
  isLogScale.value = !isLogScale.value;
  if (chart) {
    chart.priceScale('right').applyOptions({
      mode: isLogScale.value ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    });
  }
}

function applyOptimalVisibleRange(totalBars: number) {
  if (!chart || totalBars <= 0) return;
  if (totalBars <= 20) {
    chart.timeScale().fitContent();
    chart.timeScale().applyOptions({ barSpacing: 22, rightOffset: 12 });
  } else {
    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, totalBars - 35),
      to: totalBars + 6,
    });
  }
}

function fitContent() {
  if (chart) {
    const formatted = formatData(props.data);
    if (formatted.length > 35) {
      chart.timeScale().setVisibleLogicalRange({
        from: Math.max(0, formatted.length - 35),
        to: formatted.length + 6,
      });
    } else {
      chart.timeScale().fitContent();
      chart.timeScale().applyOptions({ barSpacing: 22, rightOffset: 12 });
    }
  }
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
      candleSeries.applyOptions({
        priceFormat: getPriceFormatOptions(formatted),
        autoscaleInfoProvider: makeAutoscaleProvider(flatPrice),
      });
      candleSeries.setData(formatted);
    } else if (areaSeries) {
      areaSeries.applyOptions({
        priceFormat: getPriceFormatOptions(formatted),
        autoscaleInfoProvider: makeAutoscaleProvider(flatPrice),
      });
      areaSeries.setData(formatted.map((d) => ({ time: d.time, value: d.close })));
    }

    if (volumeSeries) {
      volumeSeries.setData(
        formatted.map((d) => ({
          time: d.time,
          value: d.volume,
          color: d.close >= d.open ? 'rgba(34, 197, 94, 0.55)' : 'rgba(239, 68, 68, 0.55)',
        })),
      );
    }

    if (formatted.length > 0) {
      applyOptimalVisibleRange(formatted.length);
    }
  },
  { deep: true },
);

watch(
  () => props.resolution,
  () => {
    if (chart) {
      chart.timeScale().resetTimeScale();
      const formatted = formatData(props.data);
      applyOptimalVisibleRange(formatted.length);
    }
  },
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
      class="flex flex-wrap items-center justify-between gap-2 text-xs font-mono px-2 py-1.5 rounded-lg bg-muted/40 border border-border"
    >
      <!-- Left: Symbol + Mode Toggles + OHLCV live bar -->
      <div class="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
        <span
          v-if="tokenSymbol"
          class="font-extrabold tracking-wider text-foreground px-1.5 py-0.5 rounded bg-muted text-[11px]"
        >
          {{ tokenSymbol }}/{{ activeCurrencyMode === 'native' ? nativeSymbol : 'USD' }}
        </span>

        <!-- PRICE / MCAP switcher (lunch.fun style) -->
        <div
          class="flex items-center bg-muted p-0.5 rounded-lg border border-border text-[10px] font-bold"
        >
          <button
            type="button"
            class="px-2 py-0.5 rounded transition cursor-pointer"
            :class="
              activeChartMode === 'price'
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="setChartMode('price')"
          >
            PRICE
          </button>
          <button
            type="button"
            class="px-2 py-0.5 rounded transition cursor-pointer"
            :class="
              activeChartMode === 'mcap'
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="setChartMode('mcap')"
          >
            MCAP
          </button>
        </div>

        <!-- USD / Native switcher (lunch.fun style) -->
        <div
          v-if="activeChartMode === 'price'"
          class="flex items-center bg-muted p-0.5 rounded-lg border border-border text-[10px] font-bold"
        >
          <button
            type="button"
            class="px-2 py-0.5 rounded transition cursor-pointer"
            :class="
              activeCurrencyMode === 'usd'
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="setCurrencyMode('usd')"
          >
            USD
          </button>
          <button
            type="button"
            class="px-2 py-0.5 rounded transition cursor-pointer"
            :class="
              activeCurrencyMode === 'native'
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="setCurrencyMode('native')"
          >
            {{ nativeSymbol || 'ETH' }}
          </button>
        </div>

        <div v-if="activeBar" class="flex items-center gap-2.5 text-[11px] flex-wrap">
          <span class="text-muted-foreground">
            O:
            <span class="font-bold text-foreground">{{ formatPrice(activeBar.open) }}</span>
          </span>
          <span class="text-muted-foreground">
            H:
            <span class="font-bold text-foreground">{{ formatPrice(activeBar.high) }}</span>
          </span>
          <span class="text-muted-foreground">
            L:
            <span class="font-bold text-foreground">{{ formatPrice(activeBar.low) }}</span>
          </span>
          <span class="text-muted-foreground">
            C:
            <span class="font-bold text-foreground">
              {{ formatPrice(activeBar.close) }}
            </span>
          </span>
          <span
            :class="[
              'px-1.5 py-0.5 rounded font-bold text-[10px] border transition-colors',
              barChangePercent >= 0
                ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30'
                : 'text-rose-500 bg-rose-500/10 border-rose-500/30',
            ]"
          >
            {{ barChangePercent >= 0 ? '+' : '' }}{{ barChangePercent.toFixed(2) }}%
          </span>
          <span v-if="activeBar.volume !== undefined" class="text-muted-foreground">
            Vol:
            <span class="font-bold text-foreground">${{ formatVolume(activeBar.volume) }}</span>
          </span>
        </div>

        <span
          v-if="dataIsFlat && (data?.length ?? 0) > 1"
          class="text-[10px] font-mono text-muted-foreground ml-1 italic"
        >
          no price movement yet
        </span>
      </div>

      <!-- Right: Chart controls -->
      <div class="flex items-center gap-1.5 shrink-0 ml-auto flex-wrap">
        <button
          type="button"
          class="p-1 rounded text-muted-foreground hover:text-foreground transition cursor-pointer"
          :class="chartType === 'candles' ? 'bg-muted text-foreground' : ''"
          title="Candlestick chart"
          aria-label="Candlestick chart"
          @click="toggleChartType('candles')"
        >
          <CandlestickChart class="w-3.5 h-3.5" />
        </button>

        <!-- Area toggle -->
        <button
          type="button"
          class="p-1 rounded text-muted-foreground hover:text-foreground transition cursor-pointer"
          :class="chartType === 'area' ? 'bg-muted text-foreground' : ''"
          title="Area chart"
          aria-label="Area chart"
          @click="toggleChartType('area')"
        >
          <TrendingUp class="w-3.5 h-3.5" />
        </button>

        <span class="w-px h-3.5 bg-border mx-0.5" />

        <!-- LOG / LIN -->
        <button
          type="button"
          class="px-1.5 py-0.5 text-[10px] font-bold rounded text-muted-foreground hover:text-foreground transition cursor-pointer"
          :class="isLogScale ? 'bg-muted text-foreground' : ''"
          title="Toggle log / linear scale"
          aria-label="Toggle log / linear scale"
          @click="toggleLogScale"
        >
          {{ isLogScale ? 'LOG' : 'LIN' }}
        </button>

        <!-- Fit content -->
        <button
          type="button"
          class="p-1 rounded text-muted-foreground hover:text-foreground transition cursor-pointer"
          title="Fit chart to content"
          aria-label="Fit chart to content"
          @click="fitContent"
        >
          <Maximize2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Token Candlestick Chart Canvas (TradingView Lightweight Charts) -->
    <div
      v-show="chartType === 'candles'"
      ref="chartContainer"
      class="w-full rounded-2xl overflow-hidden border border-border bg-black shadow-xs"
      :style="{ minHeight: `${props.height}px` }"
    />

    <!-- Custom Shadcn Area / Line Chart with Glowing Gradient & Floating Tooltip -->
    <div
      v-if="chartType === 'area'"
      class="w-full rounded-2xl overflow-hidden border border-border bg-black shadow-xs p-1"
    >
      <ShadcnTradingLineChart
        :data="props.data"
        :height="props.height"
        :token-symbol="props.tokenSymbol"
        :native-symbol="props.nativeSymbol"
        :chart-mode="activeChartMode"
        :currency-mode="activeCurrencyMode"
        :multiplier="getModeMultiplier()"
        @hover-bar="onShadcnBarHover"
      />
    </div>
  </div>
</template>
