<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  AreaSeries,
  PriceScaleMode,
  CrosshairMode,
  ColorType,
  TickMarkType,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type AutoscaleInfo,
} from 'lightweight-charts';
import { Maximize, Minimize, ChevronsRight, Loader2 } from 'lucide-vue-next';
import { formatCompactUsd, formatPriceUsd } from '@/lib/utils';

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
  /** Live figures for the headline above the chart (the stream's, not the last candle's). */
  livePrice?: number;
  liveMarketCap?: number;
  change24h?: number;
}

const props = withDefaults(defineProps<Props>(), {
  tokenSymbol: '',
  tokenAddress: '',
  height: 420,
  resolution: 1,
  loading: false,
  totalSupply: 1_000_000_000,
  isGraduated: false,
});

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const root = ref<HTMLElement | null>(null);
const chartContainer = ref<HTMLDivElement | null>(null);

let chart: IChartApi | null = null;
let mainSeries: ISeriesApi<'Candlestick' | 'Area'> | null = null;
let volumeSeries: ISeriesApi<'Histogram'> | null = null;
let themeObserver: MutationObserver | null = null;

// Bars currently drawn (already scaled for the active mode). Read by autoscale.
let shownBars: Bar[] = [];
let lastKey = '';

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
// Outlier wicks never stretch the scale (a single fat-finger trade flattened every other candle).
const clipWicks = ref(true);
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
/** Bars with no trades (gap fill) draw as a quiet line instead of a bullish tick. */
const FLAT = 'rgba(113, 113, 122, 0.55)';

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
// Formatters
// ---------------------------------------------------------------------------

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const toSub = (n: number) => String(n).replace(/\d/g, (d) => SUB[+d]);

/**
 * Height of the visible price range, set by autoscale. Axis labels get enough digits to tell
 * neighbouring ticks apart: a $3.95K-$4.05K range reads $3.96K, $3.98K... instead of $4.0K x7.
 */
let visibleSpan = 0;

/** Significant digits needed to resolve steps of visibleSpan / 10 at value v. */
function sigDigits(v: number, min: number, max: number): number {
  if (!(visibleSpan > 0) || !(v > 0)) return min;
  const need = Math.ceil(Math.log10(v / (visibleSpan / 10))) + 1;
  return Math.min(max, Math.max(min, need));
}

/** 0.00000012345 -> 0.0₆12345 (DEX convention) */
function formatPrice(v: number): string {
  if (!isFinite(v) || v === 0) return '0';
  if (v >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (v >= 0.0001) return v.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  const [m, e] = v.toExponential(sigDigits(v, 4, 7) - 1).split('e');
  const zeros = Math.abs(Number(e)) - 1;
  const sig = m.replace('.', '').replace(/0+$/, '');
  return `0.0${toSub(zeros)}${sig}`;
}

function formatCompact(v: number): string {
  if (!isFinite(v)) return '0';
  const a = Math.abs(v);
  const unit = a >= 1e9 ? 1e9 : a >= 1e6 ? 1e6 : a >= 1e3 ? 1e3 : 1;
  const suffix = unit === 1e9 ? 'B' : unit === 1e6 ? 'M' : unit === 1e3 ? 'K' : '';
  // Decimals from the tick step, not the value, so every label on the axis has the same number
  // of digits ($2.48K, $2.52K, $2.56K) instead of a mix like $2.48K and $2.640K.
  const step = visibleSpan > 0 ? visibleSpan / 10 / unit : 0;
  const fromStep = step > 0 ? Math.ceil(-Math.log10(step)) : 0;
  const minDecimals = unit === 1 && a < 100 ? 2 : unit === 1 ? 0 : 1;
  const decimals = Math.min(4, Math.max(minDecimals, fromStep));
  return `${(v / unit).toFixed(decimals)}${suffix}`;
}

function formatY(v: number): string {
  return valueMode.value === 'mcap' ? `$${formatCompact(v)}` : `$${formatPrice(v)}`;
}

function formatTime(t: Time): string {
  const isSubMinute = (props.resolution ?? 1) < 60;
  return new Date(Number(t) * 1000).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...(isSubMinute ? { second: '2-digit' } : {}),
  });
}

// ---------------------------------------------------------------------------
// Autoscale: ignore extreme wicks so candle bodies stay readable
// ---------------------------------------------------------------------------

/**
 * A range narrower than this share of the price would stretch a 0.2% move across the whole pane
 * (one candle as a full-height bar), so it is widened around its middle.
 */
const MIN_RELATIVE_SPAN = 0.04;

function autoscale(original: () => AutoscaleInfo | null): AutoscaleInfo | null {
  const res = withMinimumSpan(autoscaleRange(original));
  visibleSpan = res?.priceRange ? res.priceRange.maxValue - res.priceRange.minValue : 0;
  return res;
}

function withMinimumSpan(res: AutoscaleInfo | null): AutoscaleInfo | null {
  if (!res?.priceRange) return res;
  const { minValue, maxValue } = res.priceRange;
  const mid = (minValue + maxValue) / 2;
  const minSpan = Math.abs(mid) * MIN_RELATIVE_SPAN;
  if (!(minSpan > 0) || maxValue - minValue >= minSpan) return res;
  return {
    priceRange: { minValue: Math.max(0, mid - minSpan / 2), maxValue: mid + minSpan / 2 },
    margins: res.margins,
  };
}

function autoscaleRange(original: () => AutoscaleInfo | null): AutoscaleInfo | null {
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
      fontFamily: 'Poppins, ui-sans-serif, system-ui, sans-serif', // the site's font, not monospace
      fontSize: 12,
      attributionLogo: false, // remove TradingView watermark logo
    },
    grid: { vertLines: { visible: false }, horzLines: { color: line } },
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
      secondsVisible: (props.resolution ?? 1) < 60,
      rightOffset: 6,
      barSpacing: 14,
      minBarSpacing: 1,
      tickMarkFormatter: (t: Time, type: TickMarkType) => {
        const d = new Date(Number(t) * 1000);
        if (type === TickMarkType.Time || type === TickMarkType.TimeWithSeconds) {
          return d.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
            ...((props.resolution ?? 1) < 60 ? { second: '2-digit' } : {}),
          });
        }
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

  chart.subscribeCrosshairMove((param) => {
    if (!param?.time || !mainSeries) {
      hoveredBar.value = null;
      return;
    }
    const d = param.seriesData.get(mainSeries);
    const v = volumeSeries ? param.seriesData.get(volumeSeries) : undefined;
    if (!d || !('open' in d || 'value' in d)) {
      hoveredBar.value = null;
      return;
    }
    hoveredBar.value = {
      time: param.time,
      ...('open' in d
        ? { open: d.open, high: d.high, low: d.low, close: d.close }
        : { open: d.value, high: d.value, low: d.value, close: d.value }),
      volume: v && 'value' in v ? Number(v.value) : 0,
    };
  });

  chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
    isAwayFromLatest.value = !!range && shownBars.length > 0 && range.to < shownBars.length - 3;
  });

  themeObserver = new MutationObserver(() => {
    chart?.applyOptions(themeOptions());
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

const isFlat = (b: Bar) => b.volume === 0 && b.open === b.close && b.high === b.low;

function toMain(b: Bar) {
  if (chartType.value !== 'candles') return { time: b.time, value: b.close };
  const bar = { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close };
  return isFlat(b) ? { ...bar, color: FLAT, borderColor: FLAT, wickColor: FLAT } : bar;
}
const toVol = (b: Bar) => ({
  time: b.time,
  value: b.volume,
  color: b.volume === 0 ? 'transparent' : b.close >= b.open ? BULL_VOL : BEAR_VOL,
});

/** Index of the first bar of `next` that `prev` does not show as is (prev.length when none). */
function firstChangedBar(prev: Bar[], next: Bar[]): number {
  const n = Math.min(prev.length, next.length);
  for (let i = 0; i < n; i++) {
    const a = prev[i]!;
    const b = next[i]!;
    if (
      a.time !== b.time ||
      a.open !== b.open ||
      a.high !== b.high ||
      a.low !== b.low ||
      a.close !== b.close ||
      a.volume !== b.volume
    ) {
      return i;
    }
  }
  return n;
}

function sync(base: Bar[], forceFull = false) {
  if (!chartReady || !chart || !mainSeries || !volumeSeries) return;
  const bars = scaleBars(base);
  const prev = shownBars;
  shownBars = bars;

  const key = `${props.tokenAddress}|${props.resolution}|${valueMode.value}|${chartType.value}|${props.totalSupply}`;
  const keyChanged = key !== lastKey;
  lastKey = key;

  if (keyChanged || forceFull || prev.length === 0) {
    // Full replace when the token, resolution or mode changed, or on first load.
    mainSeries.setData(bars.map(toMain));
    volumeSeries.setData(bars.map(toVol));
    showLatest(bars.length);
  } else {
    const from = firstChangedBar(prev, bars);
    if (from >= prev.length - 1 && bars.length >= prev.length) {
      // Only the last bar changed or bars were added: update them in place, scroll untouched.
      for (let i = from; i < bars.length; i++) {
        mainSeries.update(toMain(bars[i]!));
        volumeSeries.update(toVol(bars[i]!));
      }
    } else if (from < bars.length || bars.length !== prev.length) {
      // An older bar changed (a trade indexed after its bar had passed): series.update cannot
      // rewrite it, so replace the data and keep the range the viewer is looking at.
      const range = chart.timeScale().getVisibleLogicalRange();
      mainSeries.setData(bars.map(toMain));
      volumeSeries.setData(bars.map(toVol));
      if (range) chart.timeScale().setVisibleLogicalRange(range);
    }
  }
}

/** Pixels per candle when the chart opens: readable bodies, like a trading terminal's default. */
const OPEN_BAR_PX = 12;

/**
 * Opens on the latest moves at a readable width. Only traded candles are drawn, so a coin with
 * three trades shows three clear candles at the left (the rest of the pane stays empty) rather
 * than three slivers squeezed by a day of empty bars; a long history shows its latest candles
 * and scrolls back.
 */
function showLatest(total: number) {
  if (!chart || total <= 0) return;
  requestAnimationFrame(() => {
    if (!chart) return;
    const width = chartContainer.value?.clientWidth ?? 800;
    const inView = Math.max(20, Math.floor(width / OPEN_BAR_PX));
    chart.timeScale().applyOptions({ rightOffset: 4 });
    chart
      .timeScale()
      .setVisibleLogicalRange(
        total < inView ? { from: -1, to: inView - 1 } : { from: total - inView + 4, to: total + 3 },
      );
  });
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
  () => props.totalSupply,
  () => {
    if (!chartReady) return;
    lastKey = '';
    sync(formatted.value, true);
  },
);

/**
 * Force a full chart reset when the resolution (timeframe) changes.
 * The key inside sync() already handles this via keyChanged, but watching
 * resolution explicitly ensures the time-scale resets and fitContent() fires
 * even when the data array length happens to be the same across timeframes.
 */
watch(
  () => props.resolution,
  (newRes) => {
    if (!chartReady || !chart) return;
    chart.timeScale().applyOptions({
      secondsVisible: (newRes ?? 1) < 60,
    });
    // Reset lastKey so the next sync() treats it as a new context unconditionally
    lastKey = '';
    sync(formatted.value, true);
  },
);

// ---------------------------------------------------------------------------
// Toolbar actions
// ---------------------------------------------------------------------------

function setChartType(type: 'candles' | 'area') {
  if (chartType.value === type || !chart || !mainSeries) return;
  chartType.value = type;
  chart.removeSeries(mainSeries); // keep zoom, only swap the series
  createMainSeries();
  sync(formatted.value, true);
  savePrefs();
}

function setMode(mode: 'price' | 'mcap') {
  if (valueMode.value === mode) return;
  valueMode.value = mode;
  hoveredBar.value = null;
  mainSeries?.applyOptions({
    priceFormat: { type: 'custom', formatter: formatY, minMove: 1e-11 },
  });
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

const INTERVAL_LABELS: Record<number, string> = {
  1: '1s',
  60: '1m',
  300: '5m',
  900: '15m',
  3600: '1h',
  14400: '4h',
  86400: '1d',
};

/** "KTU · 15m · Market cap": readable in any screenshot, like a terminal's chart title. */
const contextLabel = computed(() =>
  [
    props.tokenSymbol?.toUpperCase(),
    INTERVAL_LABELS[props.resolution ?? 1] ?? `${props.resolution}s`,
    valueMode.value === 'mcap' ? 'Market cap' : 'Price',
  ]
    .filter(Boolean)
    .join(' · '),
);

/** Live value in the chart's unit, labelled, so the big number always says what it is. */
const headline = computed(() => {
  if (valueMode.value === 'mcap') {
    const v = props.liveMarketCap;
    return v !== undefined && v > 0 ? { label: 'Market cap', value: formatCompactUsd(v) } : null;
  }
  const v = props.livePrice;
  return v !== undefined && v > 0 ? { label: 'Price', value: formatPriceUsd(v) } : null;
});

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
    <!-- Toolbar: one row on wide screens (wraps on phones), big touch targets -->
    <!-- Headline: what the chart shows, its live value and the 24h move -->
    <div v-if="headline" class="px-4 pt-4">
      <span class="text-xs text-muted-foreground">{{ headline.label }}</span>
      <div class="flex items-baseline gap-2">
        <span
          class="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground tabular-nums"
        >
          {{ headline.value }}
        </span>
        <span
          v-if="change24h !== undefined"
          class="text-sm font-medium tabular-nums"
          :class="change24h >= 0 ? 'text-emerald-500' : 'text-rose-500'"
        >
          {{ change24h >= 0 ? '+' : '' }}{{ change24h.toFixed(2) }}% 24h
        </span>
      </div>
    </div>

    <!-- On phones the interval takes the first row; value and tools share the second. -->
    <div class="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border/80">
      <!-- Host controls, e.g. the candle interval -->
      <slot name="toolbar-start" />
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

      <!-- Line / Candles -->
      <div class="flex items-center rounded-lg bg-muted p-0.5" role="group" aria-label="Chart type">
        <button
          v-for="c in [
            { v: 'area', l: 'Line' },
            { v: 'candles', l: 'Candles' },
          ] as const"
          :key="c.v"
          type="button"
          class="h-8 cursor-pointer rounded-md px-3 text-xs font-semibold transition"
          :class="
            chartType === c.v
              ? 'bg-card text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          "
          :aria-pressed="chartType === c.v"
          @click="setChartType(c.v)"
        >
          {{ c.l }}
        </button>
      </div>

      <div class="ml-auto flex items-center gap-1">
        <button
          type="button"
          class="hidden sm:grid h-8 w-8 cursor-pointer place-items-center rounded-md text-xs font-bold transition"
          :class="
            isLogScale ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
          "
          title="Logarithmic scale"
          aria-label="Logarithmic scale"
          :aria-pressed="isLogScale"
          @click="toggleLog"
        >
          Log
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

      <!-- What the chart is (symbol, interval, unit) at all times; OHLC of the hovered candle -->
      <div
        class="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
      >
        <span class="font-medium">{{ contextLabel }}</span>
        <span v-if="hoveredBar && activeBar" class="font-semibold text-foreground">
          {{ activeBar.close >= activeBar.open ? '▲' : '▼' }}
        </span>
        <span v-if="hoveredBar && activeBar">
          O: <span class="text-foreground">{{ formatY(activeBar.open) }}</span>
        </span>
        <span v-if="hoveredBar && activeBar">
          H: <span class="text-foreground">{{ formatY(activeBar.high) }}</span>
        </span>
        <span v-if="hoveredBar && activeBar">
          L: <span class="text-foreground">{{ formatY(activeBar.low) }}</span>
        </span>
        <span v-if="hoveredBar && activeBar">
          C: <span class="text-foreground">{{ formatY(activeBar.close) }}</span>
        </span>
        <span
          v-if="hoveredBar && activeBar"
          :class="activeBar.close >= activeBar.open ? 'text-bullish' : 'text-bearish'"
        >
          {{ changePct >= 0 ? '+' : '' }}{{ changePct.toFixed(2) }}%
        </span>
        <span v-if="hoveredBar && activeBar && activeBar.volume" class="hidden sm:inline">
          Vol: <span class="text-foreground">{{ formatCompactUsd(activeBar.volume) }}</span>
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
        <span class="text-xs">No trades in this resolution yet</span>
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
