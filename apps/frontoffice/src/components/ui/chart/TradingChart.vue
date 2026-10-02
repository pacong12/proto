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
// Types & Props
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
  marketCapUsd?: number;
  currentPriceUsd?: number;
  volume24hUsd?: number;
  priceChange24h?: number;
  totalSupply?: string | number;
}

const props = withDefaults(defineProps<Props>(), {
  tokenSymbol: '',
  tokenAddress: '',
  height: 360,
  resolution: 3600,
  marketCapUsd: 0,
  currentPriceUsd: 0,
  volume24hUsd: 0,
  priceChange24h: 0,
  totalSupply: '1000000000',
});

const emit = defineEmits<{
  (e: 'changeResolution', seconds: number): void;
}>();

// ---------------------------------------------------------------------------
// View Mode & Timeframe State (ubi.fun exact layout)
// ---------------------------------------------------------------------------

export type ChartMode = 'mktcap' | 'price' | 'volume';
const activeMode = ref<ChartMode>('mktcap');
const priceChartType = ref<'candles' | 'area'>('candles');
const isLogScale = ref(false);

const timeframes = [
  { label: '1m', seconds: 60 },
  { label: '15m', seconds: 900 },
  { label: '1h', seconds: 3600 },
  { label: '4h', seconds: 14400 },
  { label: '1d', seconds: 86400 },
];

// ---------------------------------------------------------------------------
// Refs & Chart Instances
// ---------------------------------------------------------------------------

const chartContainer = ref<HTMLDivElement | null>(null);
let chart: IChartApi | null = null;
let candleSeries: ISeriesApi<'Candlestick'> | null = null;
let areaSeries: ISeriesApi<'Area'> | null = null;
let volumeSeries: ISeriesApi<'Histogram'> | null = null;
let resizeObserver: ResizeObserver | null = null;
let themeObserver: MutationObserver | null = null;

const hoveredPoint = ref<{
  time: number;
  value: number;
  open?: number;
  close?: number;
  volume?: number;
} | null>(null);

// ---------------------------------------------------------------------------
// Standard Colors
// ---------------------------------------------------------------------------

const BULLISH_GREEN = '#21C95E';
const BEARISH_RED = '#FF593C';

function checkDark(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

// ---------------------------------------------------------------------------
// Token Math & Data Formatting
// ---------------------------------------------------------------------------

function getImplicitSupply(): number {
  if (props.marketCapUsd && props.currentPriceUsd && props.currentPriceUsd > 0) {
    return props.marketCapUsd / props.currentPriceUsd;
  }
  const raw = Number(props.totalSupply);
  if (!isNaN(raw) && raw > 0) {
    return raw > 1e15 ? raw / 1e18 : raw;
  }
  return 1_000_000_000;
}

function formatData(rawData: CandlePoint[]) {
  if (!rawData || rawData.length === 0) return [];

  const converted = rawData.map((item) => {
    let tNum =
      typeof item.time === 'string' ? new Date(item.time).getTime() / 1000 : Number(item.time);
    if (tNum > 2_000_000_000) tNum = tNum / 1000;
    const t = Math.floor(tNum);

    const open = Number(item.open);
    const close = Number(item.close);
    const rawHigh = Number(item.high);
    const rawLow = Number(item.low);

    const high = Math.max(open, close, rawHigh);
    const low = Math.min(open, close, rawLow);

    return {
      time: t as Time,
      timeNum: t,
      open,
      high,
      low,
      close,
      volume: Number(item.volume ?? 0),
    };
  });

  converted.sort((a, b) => a.timeNum - b.timeNum);

  const seen = new Map<number, (typeof converted)[0]>();
  for (const bar of converted) {
    seen.set(bar.timeNum, bar);
  }

  return Array.from(seen.values()).sort((a, b) => a.timeNum - b.timeNum);
}

function isDataFlat(data: ReturnType<typeof formatData>): boolean {
  if (data.length === 0) return true;
  const first = data[0].close;
  return data.every(
    (d) => d.open === first && d.high === first && d.low === first && d.close === first,
  );
}

function makeAutoscaleProvider(flatPrice: number | null) {
  return (original: () => AutoscaleInfo | null): AutoscaleInfo | null => {
    const res = original();
    if (!res || !res.priceRange) return res;
    const { minValue, maxValue } = res.priceRange;
    if (minValue === maxValue) {
      const val = flatPrice ?? minValue;
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
// Number & Currency Formatters (ubi.fun exact style)
// ---------------------------------------------------------------------------

function formatUsdValue(val: number): string {
  if (isNaN(val) || val === 0) return '$0.00';
  if (val >= 1_000_000_000) {
    return `$${(val / 1_000_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}B`;
  }
  if (val >= 1_000_000) {
    return `$${(val / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
  }
  if (val >= 1000) {
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (val >= 1) {
    return `$${val.toFixed(2)}`;
  }
  if (val < 0.00000001) return `$${val.toFixed(11)}`;
  if (val < 0.0001) return `$${val.toFixed(8)}`;
  return `$${val.toFixed(6)}`;
}

function formatDeltaUsd(val: number): string {
  const abs = Math.abs(val);
  const formatted = formatUsdValue(abs);
  return `${val >= 0 ? '+' : '-'}${formatted}`;
}

function formatHoveredTimestamp(timeSec: number): string {
  if (!timeSec) return '';
  const d = new Date(timeSec * 1000);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Computed: Dynamic Live / Hover Metrics
// ---------------------------------------------------------------------------

const supply = computed(() => getImplicitSupply());
const formattedBars = computed(() => formatData(props.data));

const isTrendingUp = computed(() => {
  if (formattedBars.value.length >= 2) {
    const first = formattedBars.value[0].close;
    const last = formattedBars.value[formattedBars.value.length - 1].close;
    return last >= first;
  }
  return (props.priceChange24h ?? 0) >= 0;
});

// Primary large number displayed at top-left
const displayPrimaryValue = computed(() => {
  if (hoveredPoint.value) {
    if (activeMode.value === 'mktcap') {
      return formatUsdValue(hoveredPoint.value.value);
    }
    if (activeMode.value === 'price') {
      return formatUsdValue(hoveredPoint.value.close ?? hoveredPoint.value.value);
    }
    if (activeMode.value === 'volume') {
      return formatUsdValue(hoveredPoint.value.volume ?? hoveredPoint.value.value);
    }
  }

  if (activeMode.value === 'mktcap') {
    return formatUsdValue(props.marketCapUsd || props.currentPriceUsd * supply.value || 4200);
  }
  if (activeMode.value === 'price') {
    return formatUsdValue(props.currentPriceUsd || 0);
  }
  if (activeMode.value === 'volume') {
    return props.volume24hUsd ? formatUsdValue(props.volume24hUsd) : '—';
  }
  return '$0.00';
});

// Secondary change text displayed next to large number: "+$59.43 (+0.59%)"
const displayChangeMetrics = computed(() => {
  if (hoveredPoint.value && formattedBars.value.length > 0) {
    const first = formattedBars.value[0];
    let baseVal = first.close;
    let curVal = hoveredPoint.value.close ?? hoveredPoint.value.value;

    if (activeMode.value === 'mktcap') {
      baseVal = first.close * supply.value;
      curVal = hoveredPoint.value.value;
    }

    if (baseVal > 0) {
      const delta = curVal - baseVal;
      const pct = (delta / baseVal) * 100;
      return {
        deltaUsd: formatDeltaUsd(delta),
        pct,
        isPositive: pct >= 0,
      };
    }
  }

  // Fallback to 24h change
  const pct = props.priceChange24h ?? 0;
  const currentVal =
    activeMode.value === 'mktcap'
      ? props.marketCapUsd || props.currentPriceUsd * supply.value || 4200
      : props.currentPriceUsd || 0;
  const delta = currentVal * (pct / 100);

  return {
    deltaUsd: formatDeltaUsd(delta),
    pct,
    isPositive: pct >= 0,
  };
});

const hoveredBarTime = computed(() => {
  if (hoveredPoint.value) {
    return formatHoveredTimestamp(hoveredPoint.value.time);
  }
  return '';
});

// ---------------------------------------------------------------------------
// Chart Initialization & Series Options
// ---------------------------------------------------------------------------

function getThemeConfig(isDark: boolean) {
  return {
    layout: {
      background: {
        type: ColorType.Solid,
        color: 'transparent',
      },
      textColor: isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { visible: false },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)',
        width: 1 as const,
        style: LineStyle.Dashed,
        labelBackgroundColor: isDark ? '#27272a' : '#e4e4e7',
      },
      horzLine: {
        color: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)',
        width: 1 as const,
        style: LineStyle.Dashed,
        labelBackgroundColor: isDark ? '#27272a' : '#e4e4e7',
      },
    },
    rightPriceScale: {
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
      scaleMargins: { top: 0.28, bottom: 0.12 },
      mode: isLogScale.value ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    },
    timeScale: {
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 8,
      barSpacing: 20,
      minBarSpacing: 5,
    },
  };
}

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

function applyOptimalVisibleRange(totalBars: number) {
  if (!chart || totalBars <= 0) return;
  if (totalBars <= 20) {
    chart.timeScale().fitContent();
    chart.timeScale().applyOptions({ barSpacing: 22, rightOffset: 8 });
  } else {
    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, totalBars - 40),
      to: totalBars + 4,
    });
  }
}

function initChart() {
  if (!chartContainer.value) return;
  destroyChart();

  const isDark = checkDark();
  const width = chartContainer.value.clientWidth || 700;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const responsiveHeight = isMobile ? Math.min(props.height, 300) : props.height;

  chart = createChart(chartContainer.value, {
    width,
    height: responsiveHeight,
    ...getThemeConfig(isDark),
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
    handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
  });

  const formatted = formattedBars.value;
  const flatPrice = isDataFlat(formatted) && formatted.length > 0 ? formatted[0].close : null;
  const autoscaleProvider = makeAutoscaleProvider(flatPrice);

  const mainColor = isTrendingUp.value ? BULLISH_GREEN : BEARISH_RED;

  // Render appropriate series based on activeMode
  if (activeMode.value === 'mktcap') {
    // Mode 1: Market Cap Area Curve (ubi.fun default)
    areaSeries = chart.addSeries(AreaSeries, {
      topColor: isTrendingUp.value ? 'rgba(33, 201, 94, 0.25)' : 'rgba(255, 89, 60, 0.25)',
      bottomColor: 'rgba(0, 0, 0, 0.0)',
      lineColor: mainColor,
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => {
          if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(2)}M`;
          if (price >= 1_000) return `$${(price / 1_000).toFixed(1)}K`;
          return `$${price.toFixed(2)}`;
        },
      },
      autoscaleInfoProvider: autoscaleProvider,
    });

    const mktCapData = formatted.map((d) => ({
      time: d.time,
      value: d.close * supply.value,
    }));
    areaSeries.setData(mktCapData);
  } else if (activeMode.value === 'price') {
    // Mode 2: Token Price (Candlestick or Area)
    if (priceChartType.value === 'candles') {
      candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: BULLISH_GREEN,
        downColor: BEARISH_RED,
        borderVisible: true,
        borderUpColor: BULLISH_GREEN,
        borderDownColor: BEARISH_RED,
        wickVisible: true,
        wickUpColor: BULLISH_GREEN,
        wickDownColor: BEARISH_RED,
        priceFormat: {
          type: 'custom',
          formatter: (p: number) => formatUsdValue(p).replace('$', ''),
        },
        autoscaleInfoProvider: autoscaleProvider,
      });
      candleSeries.setData(formatted);
    } else {
      areaSeries = chart.addSeries(AreaSeries, {
        topColor: isTrendingUp.value ? 'rgba(33, 201, 94, 0.25)' : 'rgba(255, 89, 60, 0.25)',
        bottomColor: 'rgba(0, 0, 0, 0.0)',
        lineColor: mainColor,
        lineWidth: 2,
        priceFormat: {
          type: 'custom',
          formatter: (p: number) => formatUsdValue(p).replace('$', ''),
        },
        autoscaleInfoProvider: autoscaleProvider,
      });
      areaSeries.setData(formatted.map((d) => ({ time: d.time, value: d.close })));
    }

    // Sub-histogram for volume
    volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeries.setData(
      formatted.map((d) => ({
        time: d.time,
        value: d.volume,
        color: d.close >= d.open ? 'rgba(33, 201, 94, 0.45)' : 'rgba(255, 89, 60, 0.45)',
      })),
    );
  } else if (activeMode.value === 'volume') {
    // Mode 3: Pure Volume Histogram
    volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
    });
    volumeSeries.setData(
      formatted.map((d) => ({
        time: d.time,
        value: d.volume,
        color: d.close >= d.open ? BULLISH_GREEN : BEARISH_RED,
      })),
    );
  }

  if (formatted.length > 0) {
    applyOptimalVisibleRange(formatted.length);
  }

  // Crosshair subscriber to update live numbers & hover timestamp
  chart.subscribeCrosshairMove((param) => {
    if (!param || !param.time) {
      hoveredPoint.value = null;
      return;
    }

    const t = Number(param.time);

    if (activeMode.value === 'mktcap' && areaSeries) {
      const data = param.seriesData.get(areaSeries);
      if (data && 'value' in data) {
        hoveredPoint.value = { time: t, value: Number(data.value) };
      }
    } else if (activeMode.value === 'price') {
      const activeS = candleSeries ?? areaSeries;
      if (activeS) {
        const data = param.seriesData.get(activeS);
        const volData = volumeSeries ? param.seriesData.get(volumeSeries) : null;
        const v = volData && 'value' in volData ? Number(volData.value) : 0;

        if (data && 'open' in data) {
          hoveredPoint.value = {
            time: t,
            value: Number(data.close),
            open: Number(data.open),
            close: Number(data.close),
            volume: v,
          };
        } else if (data && 'value' in data) {
          hoveredPoint.value = {
            time: t,
            value: Number(data.value),
            close: Number(data.value),
            volume: v,
          };
        }
      }
    } else if (activeMode.value === 'volume' && volumeSeries) {
      const data = param.seriesData.get(volumeSeries);
      if (data && 'value' in data) {
        hoveredPoint.value = { time: t, value: Number(data.value), volume: Number(data.value) };
      }
    }
  });

  // Responsive resize
  resizeObserver = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect.width;
    if (w && w > 0 && chart) {
      const isMob = typeof window !== 'undefined' && window.innerWidth < 640;
      const h = isMob ? Math.min(props.height, 300) : props.height;
      chart.applyOptions({ width: w, height: h });
    }
  });
  resizeObserver.observe(chartContainer.value);

  // Dark/Light mode theme updates
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
// Actions
// ---------------------------------------------------------------------------

function setMode(mode: ChartMode) {
  if (activeMode.value === mode) return;
  activeMode.value = mode;
  initChart();
}

function selectTimeframe(seconds: number) {
  emit('changeResolution', seconds);
}

function togglePriceChartType(type: 'candles' | 'area') {
  if (priceChartType.value === type) return;
  priceChartType.value = type;
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
    applyOptimalVisibleRange(formattedBars.value.length);
  }
}

// ---------------------------------------------------------------------------
// Watchers & Lifecycle
// ---------------------------------------------------------------------------

watch(
  () => [props.data, props.marketCapUsd, props.currentPriceUsd],
  () => {
    initChart();
  },
  { deep: true },
);

watch(
  () => props.resolution,
  () => {
    initChart();
  },
);

onMounted(() => initChart());
onUnmounted(() => destroyChart());
</script>

<template>
  <div class="rounded-2xl border border-border bg-card overflow-hidden relative shadow-xs">
    <!-- Chart Canvas Container with ubi.fun signature radial dot grid matrix -->
    <div
      class="relative w-full overflow-hidden bg-dot-matrix"
      :style="{ minHeight: `${props.height}px` }"
    >
      <!-- Top-Left Floating Live Metrics (ubi.fun layout) -->
      <div class="absolute top-4 left-4 z-10 pointer-events-none select-none">
        <div class="flex items-baseline gap-2.5 flex-wrap">
          <h2 class="text-3xl sm:text-4xl font-black tracking-tight text-foreground font-mono">
            {{ displayPrimaryValue }}
          </h2>
          <div
            v-if="displayChangeMetrics"
            class="flex items-baseline gap-1 text-sm font-mono font-bold"
            :class="displayChangeMetrics.isPositive ? 'text-[#21C95E]' : 'text-[#FF593C]'"
          >
            <span>{{ displayChangeMetrics.deltaUsd }}</span>
            <span
              >({{ displayChangeMetrics.isPositive ? '+' : ''
              }}{{ displayChangeMetrics.pct.toFixed(2) }}%)</span
            >
          </div>
        </div>

        <!-- Hovered Timestamp or Mode indicator -->
        <div class="text-[11px] font-mono text-muted-foreground mt-0.5 flex items-center gap-1.5">
          <span
            class="inline-block w-1.5 h-1.5 rounded-full"
            :class="displayChangeMetrics.isPositive ? 'bg-[#21C95E]' : 'bg-[#FF593C]'"
          />
          <span v-if="hoveredBarTime">{{ hoveredBarTime }}</span>
          <span v-else>
            {{
              activeMode === 'mktcap'
                ? 'Market cap'
                : activeMode === 'price'
                  ? `${props.tokenSymbol || 'Token'} / USD`
                  : 'Volume'
            }}
          </span>
        </div>
      </div>

      <!-- TradingView Lightweight Charts Canvas -->
      <div ref="chartContainer" class="w-full" :style="{ minHeight: `${props.height}px` }" />
    </div>

    <!-- Bottom Toolbar Row: Timeframes on left, Mode Switcher on right (ubi.fun exact layout) -->
    <div
      class="flex flex-wrap items-center justify-between gap-2 px-3.5 sm:px-4 py-2 border-t border-border/50 bg-card/60 text-xs font-mono select-none"
    >
      <!-- Left: Timeframe Switcher (1m, 15m, 1h, 4h, 1d) -->
      <div class="flex items-center gap-1">
        <button
          v-for="tf in timeframes"
          :key="tf.label"
          type="button"
          class="px-2 py-1 rounded-md transition-colors cursor-pointer text-xs"
          :class="
            props.resolution === tf.seconds
              ? 'text-foreground font-bold bg-muted/80'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="selectTimeframe(tf.seconds)"
        >
          {{ tf.label }}
        </button>
      </div>

      <!-- Right: Mode Switcher (Mkt cap, Price, Volume) & Controls -->
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="px-2.5 py-1 rounded-md transition-colors cursor-pointer text-xs"
          :class="
            activeMode === 'mktcap'
              ? 'text-foreground font-bold bg-muted/80'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="setMode('mktcap')"
        >
          Mkt cap
        </button>
        <button
          type="button"
          class="px-2.5 py-1 rounded-md transition-colors cursor-pointer text-xs"
          :class="
            activeMode === 'price'
              ? 'text-foreground font-bold bg-muted/80'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="setMode('price')"
        >
          Price
        </button>
        <button
          type="button"
          class="px-2.5 py-1 rounded-md transition-colors cursor-pointer text-xs"
          :class="
            activeMode === 'volume'
              ? 'text-foreground font-bold bg-muted/80'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="setMode('volume')"
        >
          Volume
        </button>

        <!-- Sub-controls when Price mode is active (Candles vs Area toggle) -->
        <template v-if="activeMode === 'price'">
          <span class="w-px h-3.5 bg-border mx-1" />
          <button
            type="button"
            class="p-1 rounded text-muted-foreground hover:text-foreground transition cursor-pointer"
            :class="priceChartType === 'candles' ? 'text-foreground bg-muted' : ''"
            title="Candlesticks"
            aria-label="Candlesticks"
            @click="togglePriceChartType('candles')"
          >
            <CandlestickChart class="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            class="p-1 rounded text-muted-foreground hover:text-foreground transition cursor-pointer"
            :class="priceChartType === 'area' ? 'text-foreground bg-muted' : ''"
            title="Line/Area"
            aria-label="Line/Area"
            @click="togglePriceChartType('area')"
          >
            <TrendingUp class="w-3.5 h-3.5" />
          </button>
        </template>

        <span class="w-px h-3.5 bg-border mx-1" />

        <!-- Scale & Fit buttons -->
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

        <button
          type="button"
          class="p-1 rounded text-muted-foreground hover:text-foreground transition cursor-pointer"
          title="Fit chart"
          aria-label="Fit chart"
          @click="fitContent"
        >
          <Maximize2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-dot-matrix {
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.16) 1.2px, transparent 1.2px);
  background-size: 20px 20px;
  background-position: 0px 0px;
}

:root:not(.dark) .bg-dot-matrix {
  background-image: radial-gradient(circle, rgba(0, 0, 0, 0.12) 1.2px, transparent 1.2px);
}
</style>
