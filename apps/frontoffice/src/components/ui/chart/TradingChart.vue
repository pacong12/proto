<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  AreaSeries,
  createTextWatermark,
  createSeriesMarkers,
  PriceScaleMode,
  CrosshairMode,
  ColorType,
  TickMarkType,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type AutoscaleInfo,
} from 'lightweight-charts';
import {
  CandlestickChart,
  TrendingUp,
  Maximize,
  Minimize,
  ScanLine,
  ChevronsRight,
  ZoomOut,
  Loader2,
} from 'lucide-vue-next';

// ---------------------------------------------------------------------------
// Types & props
// ---------------------------------------------------------------------------

export interface CandlePoint {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ChartMarker {
  time: number | string;
  position?: 'aboveBar' | 'belowBar' | 'inBar';
  color?: string;
  shape?: 'arrowUp' | 'arrowDown' | 'circle' | 'square';
  text?: string;
  size?: number;
}

interface Bar {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Props {
  data: CandlePoint[];
  tokenSymbol?: string;
  tokenAddress?: string;
  height?: number; // desktop height in px; mobile is fixed at 300
  resolution?: number;
  loading?: boolean; // parent sets true while fetching a new timeframe
  totalSupply?: number; // used for the Market Cap mode (price x supply)
  isGraduated?: boolean; // true if already graduated to DEX
  markers?: ChartMarker[]; // optional trade buy/sell markers
}

const props = withDefaults(defineProps<Props>(), {
  tokenSymbol: '',
  tokenAddress: '',
  height: 420,
  resolution: 60,
  loading: false,
  totalSupply: 1_000_000_000,
  isGraduated: false,
  markers: () => [],
});

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const root = ref<HTMLElement | null>(null);
const chartContainer = ref<HTMLDivElement | null>(null);

let chart: IChartApi | null = null;
let mainSeries: ISeriesApi<'Candlestick'> | ISeriesApi<'Area'> | null = null;
let volumeSeries: ISeriesApi<'Histogram'> | null = null;
let themeObserver: MutationObserver | null = null;
let watermarkPlugin: any = null;
let markersPlugin: any = null;

// Bars currently drawn (already scaled for the active mode). Read by autoscale.
let shownBars: Bar[] = [];
let lastKey = '';
let lastLen = 0;
let lastLastTime: number | null = null;

const PREF_KEY = 'trading-chart:prefs';
function loadPrefs(): {
  type?: string;
  mode?: string;
  log?: boolean;
  clip?: boolean;
} {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
  } catch {
    return {};
  }
}
const prefs = loadPrefs();

const chartType = ref<'candles' | 'area'>(prefs.type === 'area' ? 'area' : 'candles');
const valueMode = ref<'price' | 'mcap'>(prefs.mode === 'price' ? 'price' : 'mcap');
const isLogScale = ref(!!prefs.log);
const clipWicks = ref(prefs.clip !== false);
const isFullscreen = ref(false);

const isAwayFromLatest = ref(false);
const hoveredBar = ref<Bar | null>(null);

function savePrefs() {
  try {
    localStorage.setItem(
      PREF_KEY,
      JSON.stringify({
        type: chartType.value,
        mode: valueMode.value,
        log: isLogScale.value,
        clip: clipWicks.value,
      }),
    );
  } catch {
    // storage unavailable: ignore
  }
}

// ---------------------------------------------------------------------------
// Colors (single source of truth: matching --bull/--bear)
// ---------------------------------------------------------------------------

const BULL = '#22c55e';
const BEAR = '#ef4444';
const BULL_VOL = 'rgba(34, 197, 94, 0.6)';
const BEAR_VOL = 'rgba(239, 68, 68, 0.6)';

function isDark(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

function formatData(raw: CandlePoint[]): Bar[] {
  if (!raw || raw.length === 0) return [];
  const byTime = new Map<number, Bar>();
  for (const item of raw) {
    let t =
      typeof item.time === 'string' ? new Date(item.time).getTime() / 1000 : Number(item.time);
    if (t > 2_000_000_000) t = t / 1000; // ms -> s
    t = Math.floor(t);
    const open = Number(item.open);
    const close = Number(item.close);
    if (!isFinite(t) || !isFinite(open) || !isFinite(close)) continue;
    byTime.set(t, {
      time: t as Time,
      open,
      close,
      high: Math.max(open, close, Number(item.high)),
      low: Math.min(open, close, Number(item.low)),
      volume: Number(item.volume ?? 0),
    });
  }
  return Array.from(byTime.values()).sort((a, b) => Number(a.time) - Number(b.time));
}

// Computed once per data change
const formatted = computed(() => formatData(props.data));
const scale = computed(() => (valueMode.value === 'mcap' ? props.totalSupply : 1));

function scaleBars(bars: Bar[]): Bar[] {
  const s = scale.value;
  if (s === 1) return bars;
  return bars.map((b) => ({
    ...b,
    open: b.open * s,
    high: b.high * s,
    low: b.low * s,
    close: b.close * s,
  }));
}

// ---------------------------------------------------------------------------
// Watermark (subtle background token branding)
// ---------------------------------------------------------------------------

function updateWatermark() {
  if (!chart || !props.tokenSymbol) return;
  const dark = isDark();
  const text = props.tokenSymbol.toUpperCase();
  const color = dark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.035)';

  try {
    const panes = chart.panes();
    if (!panes || panes.length === 0) return;
    const firstPane = panes[0];

    if (!watermarkPlugin) {
      watermarkPlugin = createTextWatermark(firstPane, {
        horzAlign: 'center',
        vertAlign: 'center',
        lines: [
          {
            text,
            color,
            fontSize: 54,
            fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
            fontStyle: 'bold',
          },
        ],
      });
    } else {
      watermarkPlugin.applyOptions({
        lines: [
          {
            text,
            color,
            fontSize: 54,
            fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
            fontStyle: 'bold',
          },
        ],
      });
    }
  } catch {
    // Graceful fallback if pane watermark is unsupported
  }
}

// ---------------------------------------------------------------------------
// Series Markers (Trade Execution & Alpha Indicators)
// ---------------------------------------------------------------------------

function updateMarkers() {
  if (!mainSeries) return;
  try {
    const raw = props.markers || [];
    if (raw.length > 0) {
      const formattedMarkers = raw.map((m) => {
        let t = typeof m.time === 'string' ? new Date(m.time).getTime() / 1000 : Number(m.time);
        if (t > 2_000_000_000) t = t / 1000;
        t = Math.floor(t);
        return {
          time: t as Time,
          position: m.position || (m.shape === 'arrowDown' ? 'aboveBar' : 'belowBar'),
          color: m.color || (m.shape === 'arrowDown' ? BEAR : BULL),
          shape: m.shape || (m.position === 'aboveBar' ? 'arrowDown' : 'arrowUp'),
          text: m.text,
          size: m.size ?? 1,
        };
      });

      if (!markersPlugin) {
        markersPlugin = createSeriesMarkers(mainSeries as any, formattedMarkers as any);
      } else {
        markersPlugin.setMarkers(formattedMarkers);
      }
    } else if (markersPlugin) {
      markersPlugin.setMarkers([]);
    }
  } catch {
    // Graceful fallback
  }
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const toSub = (n: number) => String(n).replace(/\d/g, (d) => SUB[+d]);

/** 0.00000012345 -> 0.0₆12345 (DEX convention) */
function formatPrice(v: number): string {
  if (!isFinite(v) || v === 0) return '0';
  if (v >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (v >= 0.0001) return v.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  const [m, e] = v.toExponential(3).split('e');
  const zeros = Math.abs(Number(e)) - 1;
  const sig = m.replace('.', '').replace(/0+$/, '');
  return `0.0${toSub(zeros)}${sig}`;
}

function formatCompact(v: number): string {
  if (!isFinite(v)) return '0';
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(a >= 100 ? 0 : 2);
}

function formatY(v: number): string {
  return valueMode.value === 'mcap' ? `$${formatCompact(v)}` : `$${formatPrice(v)}`;
}

function formatTime(t: Time): string {
  return new Date(Number(t) * 1000).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Autoscale: ignore extreme wicks so candle bodies stay readable
// ---------------------------------------------------------------------------

function autoscale(original: () => AutoscaleInfo | null): AutoscaleInfo | null {
  const res = original();
  if (!res || !res.priceRange || !chart || shownBars.length === 0) return res;
  const { minValue, maxValue } = res.priceRange;

  const vr = chart.timeScale().getVisibleLogicalRange();
  const from = Math.max(0, Math.floor(vr?.from ?? 0));
  const to = Math.min(shownBars.length - 1, Math.ceil(vr?.to ?? shownBars.length - 1));
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = from; i <= to; i++) {
    const b = shownBars[i];
    lo = Math.min(lo, b.open, b.close);
    hi = Math.max(hi, b.open, b.close);
  }
  if (!isFinite(lo) || !isFinite(hi)) return res;

  // Flat data: give it a readable band
  if (minValue === maxValue) {
    const pad = hi * 0.05 || 1e-6;
    return {
      priceRange: { minValue: Math.max(0, lo - pad), maxValue: hi + pad },
      margins: res.margins,
    };
  }
  if (!clipWicks.value) return res;

  const pad = hi > lo ? (hi - lo) * 0.45 : hi * 0.05;
  const clippedMin = Math.max(minValue, lo - pad, lo * 0.5);
  const clippedMax = Math.min(maxValue, hi + pad);
  if (clippedMin >= clippedMax) return res;
  return { priceRange: { minValue: clippedMin, maxValue: clippedMax }, margins: res.margins };
}

// ---------------------------------------------------------------------------
// Chart construction
// ---------------------------------------------------------------------------

// True after initChart() completes — guards sync() from running before ready
let chartReady = false;

function themeOptions() {
  const dark = isDark();
  const line = dark ? 'rgba(63,63,70,0.35)' : 'rgba(228,228,231,0.7)';
  return {
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' }, // follows --card
      textColor: dark ? '#a1a1aa' : '#52525b',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: 12,
      attributionLogo: false, // remove TradingView watermark logo
    },
    grid: { vertLines: { color: line }, horzLines: { color: line } },
    crosshair: {
      vertLine: { labelBackgroundColor: dark ? '#27272a' : '#e4e4e7' },
      horzLine: { labelBackgroundColor: dark ? '#27272a' : '#e4e4e7' },
    },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false },
  };
}

function createMainSeries() {
  if (!chart) return;
  const priceFormat = { type: 'custom' as const, formatter: formatY, minMove: 1e-11 };
  if (chartType.value === 'candles') {
    mainSeries = chart.addSeries(CandlestickSeries, {
      upColor: BULL,
      downColor: BEAR,
      borderUpColor: BULL,
      borderDownColor: BEAR,
      wickUpColor: BULL,
      wickDownColor: BEAR,
      priceLineColor: BULL,
      priceFormat,
      autoscaleInfoProvider: autoscale,
    });
  } else {
    mainSeries = chart.addSeries(AreaSeries, {
      topColor: 'rgba(34, 197, 94, 0.25)',
      bottomColor: 'rgba(34, 197, 94, 0.01)',
      lineColor: BULL,
      priceLineColor: BULL,
      lineWidth: 2,
      priceFormat,
      autoscaleInfoProvider: autoscale,
    });
  }
}

function initChart() {
  if (!chartContainer.value) return;
  chartReady = false;
  destroyChart();

  chart = createChart(chartContainer.value, {
    autoSize: true, // no manual ResizeObserver needed
    ...themeOptions(),
    crosshair: { mode: CrosshairMode.Normal, ...themeOptions().crosshair },
    rightPriceScale: {
      borderVisible: false,
      scaleMargins: { top: 0.1, bottom: 0.24 },
      mode: isLogScale.value ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
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
        if (type === TickMarkType.Time || type === TickMarkType.TimeWithSeconds)
          return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        if (type === TickMarkType.Year) return String(d.getFullYear());
        if (type === TickMarkType.Month) return d.toLocaleDateString(undefined, { month: 'short' });
        return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      },
    },
    localization: { timeFormatter: formatTime }, // local timezone, not UTC
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
    handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
  });

  volumeSeries = chart.addSeries(HistogramSeries, {
    priceFormat: { type: 'volume' },
    priceScaleId: 'vol',
    lastValueVisible: false,
    priceLineVisible: false,
  });
  volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

  createMainSeries();
  updateWatermark();
  updateMarkers();

  chart.subscribeCrosshairMove((param) => {
    if (!param?.time || !mainSeries) {
      hoveredBar.value = null;
      return;
    }
    const d = param.seriesData.get(mainSeries) as any;
    const v = volumeSeries ? (param.seriesData.get(volumeSeries) as any) : null;
    if (!d) {
      hoveredBar.value = null;
      return;
    }
    const isOhlc = 'open' in d;
    hoveredBar.value = {
      time: param.time,
      open: isOhlc ? d.open : d.value,
      high: isOhlc ? d.high : d.value,
      low: isOhlc ? d.low : d.value,
      close: isOhlc ? d.close : d.value,
      volume: v && 'value' in v ? Number(v.value) : 0,
    };
  });

  chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
    isAwayFromLatest.value = !!range && shownBars.length > 0 && range.to < shownBars.length - 3;
  });

  themeObserver = new MutationObserver(() => {
    chart?.applyOptions(themeOptions());
    updateWatermark();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  lastKey = '';
  chartReady = true;
  sync(formatted.value, true);
}

function destroyChart() {
  chartReady = false;
  themeObserver?.disconnect();
  themeObserver = null;
  if (markersPlugin) {
    try {
      markersPlugin.detach();
    } catch {
      // ignore
    }
    markersPlugin = null;
  }
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
  mainSeries = null;
  volumeSeries = null;
}

// ---------------------------------------------------------------------------
// Data sync: full reset only when context changes, otherwise incremental
// ---------------------------------------------------------------------------

function toMain(b: Bar) {
  return chartType.value === 'candles'
    ? { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }
    : { time: b.time, value: b.close };
}
const toVol = (b: Bar) => ({
  time: b.time,
  value: b.volume,
  color: b.close >= b.open ? BULL_VOL : BEAR_VOL,
});

function sync(base: Bar[], forceFull = false) {
  if (!chartReady || !chart || !mainSeries || !volumeSeries) return;
  const bars = scaleBars(base);
  shownBars = bars;

  const key = `${props.tokenAddress}|${props.resolution}|${valueMode.value}|${chartType.value}`;
  const keyChanged = key !== lastKey;

  // canAppend: same context, same or +1/+2 bars, last bar time matches
  const canAppend =
    !forceFull &&
    !keyChanged &&
    lastLen > 0 &&
    bars.length >= lastLen &&
    bars.length - lastLen <= 2 &&
    Number(bars[lastLen - 1]?.time) === lastLastTime;

  if (canAppend) {
    // Only update the last candle(s) in-place — scroll position untouched
    for (let i = lastLen - 1; i < bars.length; i++) {
      (mainSeries as ISeriesApi<'Candlestick'>).update(toMain(bars[i]) as any);
      volumeSeries.update(toVol(bars[i]));
    }
  } else if (keyChanged || forceFull || lastLen === 0) {
    // Full replace only when token/resolution/mode changed, or first load
    (mainSeries as ISeriesApi<'Candlestick'>).setData(bars.map(toMain) as any);
    volumeSeries.setData(bars.map(toVol));
    showLatest(bars.length);
  } else {
    // Same context, non-append delta (shouldn't normally happen with silent merge) — still update last bar
    for (let i = Math.max(0, lastLen - 1); i < bars.length; i++) {
      (mainSeries as ISeriesApi<'Candlestick'>).update(toMain(bars[i]) as any);
      volumeSeries.update(toVol(bars[i]));
    }
  }

  updateMarkers();

  lastKey = key;
  lastLen = bars.length;
  lastLastTime = bars.length ? Number(bars[bars.length - 1].time) : null;
}

function showLatest(total: number) {
  if (!chart || total <= 0) return;
  if (total <= 20) {
    chart.timeScale().fitContent();
  } else {
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(-1, total - 60), to: total + 4 });
  }
}

watch(formatted, (bars) => {
  // Chart not yet mounted: init once the DOM is ready, then sync
  if (!chartReady) {
    if (chartContainer.value) {
      nextTick(() => {
        if (!chartReady) initChart();
      });
    }
    return;
  }
  sync(bars);
});

watch(
  () => props.markers,
  () => {
    updateMarkers();
  },
  { deep: true },
);

watch(
  () => props.tokenSymbol,
  () => {
    updateWatermark();
  },
);

// ---------------------------------------------------------------------------
// Toolbar actions
// ---------------------------------------------------------------------------

function setChartType(type: 'candles' | 'area') {
  if (chartType.value === type || !chart || !mainSeries) return;
  chartType.value = type;
  if (markersPlugin) {
    try {
      markersPlugin.detach();
    } catch {
      // ignore
    }
    markersPlugin = null;
  }
  chart.removeSeries(mainSeries); // keep zoom, only swap the series
  createMainSeries();
  sync(formatted.value, true);
  updateMarkers();
  savePrefs();
}

function setMode(mode: 'price' | 'mcap') {
  if (valueMode.value === mode) return;
  valueMode.value = mode;
  hoveredBar.value = null;
  mainSeries?.applyOptions({
    priceFormat: { type: 'custom', formatter: formatY, minMove: 1e-11 },
  } as any);
  sync(formatted.value, true);
  savePrefs();
}

function toggleLog() {
  isLogScale.value = !isLogScale.value;
  chart?.priceScale('right').applyOptions({
    mode: isLogScale.value ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
  });
  savePrefs();
}

function toggleClip() {
  clipWicks.value = !clipWicks.value;
  mainSeries?.applyOptions({ autoscaleInfoProvider: autoscale } as any); // forces a rescale
  savePrefs();
}

function fitContent() {
  chart?.timeScale().fitContent();
}

function goLatest() {
  chart?.timeScale().scrollToRealTime();
}

function toggleFullscreen() {
  if (!document.fullscreenElement) root.value?.requestFullscreen?.();
  else document.exitFullscreen?.();
}
const onFsChange = () => (isFullscreen.value = document.fullscreenElement === root.value);

// ---------------------------------------------------------------------------
// Legend (overlay inside the chart)
// ---------------------------------------------------------------------------

const activeBar = computed<Bar | null>(() => {
  if (hoveredBar.value) return hoveredBar.value;
  const bars = formatted.value;
  if (bars.length === 0) return null;
  return scaleBars([bars[bars.length - 1]])[0];
});

const changePct = computed(() => {
  const b = activeBar.value;
  return b && b.open !== 0 ? ((b.close - b.open) / b.open) * 100 : 0;
});

const isEmpty = computed(() => formatted.value.length === 0);

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(() => {
  initChart();
  document.addEventListener('fullscreenchange', onFsChange);
});
onUnmounted(() => {
  document.removeEventListener('fullscreenchange', onFsChange);
  destroyChart();
});
</script>

<template>
  <div ref="root" class="flex w-full flex-col bg-card" :class="isFullscreen ? 'h-screen' : ''">
    <!-- Toolbar: one row, big touch targets -->
    <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/80">
      <!-- Price / Market cap -->
      <div
        class="flex items-center rounded-lg bg-muted p-0.5"
        role="group"
        aria-label="Chart value"
      >
        <button
          v-for="m in [
            { v: 'mcap', l: 'Market cap' },
            { v: 'price', l: 'Price' },
          ] as const"
          :key="m.v"
          type="button"
          class="h-8 cursor-pointer rounded-md px-3 text-xs font-semibold transition"
          :class="
            valueMode === m.v
              ? 'bg-card text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          "
          :aria-pressed="valueMode === m.v"
          @click="setMode(m.v)"
        >
          {{ m.l }}
        </button>
      </div>

      <div class="flex items-center gap-1">
        <button
          type="button"
          class="grid h-8 w-8 cursor-pointer place-items-center rounded-md transition"
          :class="
            chartType === 'candles'
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          "
          title="Candles"
          aria-label="Candles"
          :aria-pressed="chartType === 'candles'"
          @click="setChartType('candles')"
        >
          <CandlestickChart class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="grid h-8 w-8 cursor-pointer place-items-center rounded-md transition"
          :class="
            chartType === 'area'
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          "
          title="Line / Area"
          aria-label="Line / Area"
          :aria-pressed="chartType === 'area'"
          @click="setChartType('area')"
        >
          <TrendingUp class="h-4 w-4" />
        </button>

        <button
          type="button"
          class="grid h-8 w-8 cursor-pointer place-items-center rounded-md transition"
          :class="
            clipWicks ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
          "
          title="Ignore outlier wicks"
          aria-label="Ignore outlier wicks"
          :aria-pressed="clipWicks"
          @click="toggleClip"
        >
          <ScanLine class="h-4 w-4" />
        </button>

        <button
          type="button"
          class="hidden sm:grid h-8 w-8 cursor-pointer place-items-center rounded-md text-xs font-mono font-bold transition"
          :class="
            isLogScale ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
          "
          title="Logarithmic scale"
          aria-label="Logarithmic scale"
          :aria-pressed="isLogScale"
          @click="toggleLog"
        >
          LOG
        </button>

        <button
          type="button"
          class="hidden sm:grid h-8 w-8 cursor-pointer place-items-center rounded-md text-muted-foreground transition hover:text-foreground"
          title="Fit content"
          aria-label="Fit content"
          @click="fitContent"
        >
          <ZoomOut class="h-4 w-4" />
        </button>

        <button
          type="button"
          class="grid h-8 w-8 cursor-pointer place-items-center rounded-md text-muted-foreground transition hover:text-foreground"
          :title="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'"
          :aria-label="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'"
          @click="toggleFullscreen"
        >
          <Minimize v-if="isFullscreen" class="h-4 w-4" />
          <Maximize v-else class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- Chart Canvas Area (relative container) -->
    <div
      class="relative w-full overflow-hidden"
      :style="{ height: isFullscreen ? 'calc(100% - 49px)' : `${height}px` }"
    >
      <div ref="chartContainer" class="h-full w-full" />

      <!-- In-chart OHLC legend (Top-left inside chart canvas) -->
      <div
        class="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted-foreground"
      >
        <span v-if="activeBar" class="font-semibold text-foreground">
          {{ activeBar.close >= activeBar.open ? '▲' : '▼' }}
        </span>
        <span v-if="activeBar">
          O: <span class="text-foreground">{{ formatY(activeBar.open) }}</span>
        </span>
        <span v-if="activeBar">
          H: <span class="text-foreground">{{ formatY(activeBar.high) }}</span>
        </span>
        <span v-if="activeBar">
          L: <span class="text-foreground">{{ formatY(activeBar.low) }}</span>
        </span>
        <span v-if="activeBar">
          C: <span class="text-foreground">{{ formatY(activeBar.close) }}</span>
        </span>
        <span
          v-if="activeBar"
          :class="activeBar.close >= activeBar.open ? 'text-bullish' : 'text-bearish'"
        >
          {{ changePct >= 0 ? '+' : '' }}{{ changePct.toFixed(2) }}%
        </span>
        <span v-if="activeBar && activeBar.volume" class="hidden sm:inline">
          Vol: <span class="text-foreground">${{ formatCompact(activeBar.volume) }}</span>
        </span>
      </div>

      <!-- Loading overlay for timeframe switching -->
      <div
        v-if="loading"
        class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-card/60 backdrop-blur-[2px]"
      >
        <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
      </div>

      <!-- Empty state -->
      <div
        v-if="isEmpty && !loading"
        class="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 text-muted-foreground"
      >
        <span class="text-xs font-mono">No trades in this resolution yet</span>
      </div>

      <!-- Return to Latest Button -->
      <button
        v-if="isAwayFromLatest"
        type="button"
        class="absolute bottom-4 right-14 z-20 flex cursor-pointer items-center gap-1 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-md backdrop-blur-xs transition hover:bg-muted"
        @click="goLatest"
      >
        <span>Latest</span>
        <ChevronsRight class="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
</template>
