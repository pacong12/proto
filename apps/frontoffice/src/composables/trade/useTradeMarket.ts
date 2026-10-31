import { ref, computed, watch, type Ref } from 'vue';
import { apiFetch } from '@/lib/api-client';
import { useTokenStream } from '@/composables/useTokenStream';
import { formatPriceUsd, formatMarketCap } from '@/lib/utils';
import {
  stableQuoteUsd,
  FALLBACK_ETH_PRICE_USD,
  type LaunchedTokenEntity,
  type TokenMarketData,
} from '@goton/shared-types';
import type { LiveTrade, TokenHolder, TradePage } from './types';

/** Whether `next` moves anything the page shows from `prev` (price, market cap, volume, progress). */
function marketChanged(prev: TokenMarketData, next: TokenMarketData): boolean {
  return (
    next.priceUsd !== prev.priceUsd ||
    next.priceInWeth !== prev.priceInWeth ||
    next.marketCapUsd !== prev.marketCapUsd ||
    next.volume24hUsd !== prev.volume24hUsd ||
    next.isGraduated !== prev.isGraduated ||
    next.graduationProgress !== prev.graduationProgress
  );
}

/**
 * Sets `target` to `rows` when any row differs. A list that keeps its length and first row still
 * changes (a holder's balance, a trader's volume), so the whole content is compared.
 */
export function replaceIfChanged<T>(target: Ref<T[]>, rows: T[]): void {
  if (JSON.stringify(rows) !== JSON.stringify(target.value)) target.value = rows;
}

/** A chart bar: time in seconds, prices in USD. */
interface CandleBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Most bars the chart keeps. */
const MAX_BARS = 1000;

/**
 * `existing` with every bar of `incoming` that is new or differs, in time order and capped at
 * MAX_BARS; null when nothing changed.
 */
export function mergeCandles(existing: CandleBar[], incoming: CandleBar[]): CandleBar[] | null {
  const byTime = new Map(existing.map((bar) => [bar.time, bar]));
  let changed = false;
  for (const bar of incoming) {
    const old = byTime.get(bar.time);
    if (
      !old ||
      old.open !== bar.open ||
      old.high !== bar.high ||
      old.low !== bar.low ||
      old.close !== bar.close ||
      old.volume !== bar.volume
    ) {
      byTime.set(bar.time, bar);
      changed = true;
    }
  }
  if (!changed) return null;
  return [...byTime.values()].sort((a, b) => a.time - b.time).slice(-MAX_BARS);
}

/** Market data of the token page: price and chart, trades, holders, top traders, the creator's activity, and their live updates (SSE first, polling as fallback). */
export function useTradeMarket(page: TradePage) {
  const { activeBottomTab, currentMarketData, currentToken, tokenLoading, tokenNetwork } = page;

  function isHolderAddress(addr: string): boolean {
    if (!addr || holders.value.length === 0) return false;
    return holders.value.some((h) => h.address.toLowerCase() === addr.toLowerCase());
  }

  // Holders & trader data
  const holders = ref<TokenHolder[]>([]);

  const holdersLoading = ref(false);

  const topTraders = ref<
    Array<{
      address: string;
      buyVolumeUsd: number;
      sellVolumeUsd: number;
      totalTrades: number;
      profitUsd: number;
      isDev: boolean;
      walletTag: string;
      firstBuyTimestamp?: number;
      firstBuyPriceUsd?: number;
      avgCostUsd?: number;
      holdingAmountTokens?: string;
      positionStatus?: 'holding' | 'partial' | 'clean_all';
    }>
  >([]);

  const topTradersLoading = ref(false);

  const devInfo = ref({
    creatorAddress: '',
    initialBuyEth: '0.00',
    currentHoldPercent: 0,
    creatorStatus: 'none',
    totalDevSoldEth: '0.00',
    hasRenounced: false,
  });

  const devHoldingPercent = computed(() => {
    if (!currentToken.value.deployer || holders.value.length === 0) return 0;
    const dev = holders.value.find(
      (h) => h.address.toLowerCase() === currentToken.value.deployer.toLowerCase(),
    );
    return dev ? dev.percent : 0;
  });

  const top10HoldingPercent = computed(() => {
    if (holders.value.length === 0) return 0;
    return holders.value.slice(0, 10).reduce((acc, h) => acc + h.percent, 0);
  });

  const burnedInfo = computed(() => {
    if (holders.value.length === 0) return { amount: 0, percent: 0 };
    const dead = holders.value.find(
      (h) =>
        h.address.toLowerCase() === '0x000000000000000000000000000000000000dead' ||
        h.address.toLowerCase() === '0x0000000000000000000000000000000000000000',
    );
    if (!dead) return { amount: 0, percent: 0 };
    return { amount: dead.balance, percent: dead.percent };
  });

  const quoteAssetPriceUsd = computed(() => {
    const peg = stableQuoteUsd(tokenNetwork.value);
    if (peg !== null) return peg;
    if (currentMarketData.value.priceInWeth > 0) {
      return currentMarketData.value.priceUsd / currentMarketData.value.priceInWeth;
    }
    return FALLBACK_ETH_PRICE_USD;
  });

  const primaryFigureMode = ref<'mcap' | 'price'>('mcap');

  function toggleHeaderFigure(): void {
    primaryFigureMode.value = primaryFigureMode.value === 'mcap' ? 'price' : 'mcap';
  }

  const primaryFigureValue = computed(() => {
    if (primaryFigureMode.value === 'mcap') {
      return formatMarketCap(currentMarketData.value.marketCapUsd);
    }
    return formatPriceUsd(currentMarketData.value.priceUsd);
  });

  const secondaryFigureValue = computed(() => {
    if (primaryFigureMode.value === 'mcap') {
      return formatPriceUsd(currentMarketData.value.priceUsd) + ' price';
    }
    return formatMarketCap(currentMarketData.value.marketCapUsd) + ' mcap';
  });

  const priceFlash = ref<'up' | 'down' | null>(null);

  let flashTimeout: ReturnType<typeof setTimeout> | null = null;

  function triggerPriceFlash(direction: 'up' | 'down') {
    priceFlash.value = direction;
    if (flashTimeout) clearTimeout(flashTimeout);
    flashTimeout = setTimeout(() => {
      priceFlash.value = null;
    }, 1200);
  }

  // Trades
  const trades = ref<LiveTrade[]>([]);

  const tradesLoading = ref(false);

  // Resolution & candle data
  const resolutions = [
    { label: '1s', seconds: 1 },
    { label: '1m', seconds: 60 },
    { label: '5m', seconds: 300 },
    { label: '15m', seconds: 900 },
    { label: '1h', seconds: 3600 },
    { label: '4h', seconds: 14400 },
    { label: '1d', seconds: 86400 },
  ];

  const TIMEFRAME_STORAGE_KEY = 'proto_chart_resolution';

  function loadSavedResolution(): number {
    if (typeof window === 'undefined') return 1;
    try {
      const val = localStorage.getItem(TIMEFRAME_STORAGE_KEY);
      if (val) {
        const num = parseInt(val, 10);
        if ([1, 60, 300, 900, 3600, 14400, 86400].includes(num)) return num;
      }
    } catch {
      // Ignore storage errors
    }
    return 1; // 1s default for real-time sub-second memecoin action
  }

  const selectedResolution = ref(loadSavedResolution());

  const candlesLoading = ref(false);

  const candlestickData = ref<
    Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>
  >([]);

  let livePollTimer: ReturnType<typeof setTimeout> | null = null;

  let livePollActive = false;

  let liveAbort: AbortController | null = null;

  // ---------------------------------------------------------------------------
  // SSE — primary realtime channel for market data.
  // Polling loop below remains active as fallback for candlesticks + tab data.
  // ---------------------------------------------------------------------------
  const {
    streamMarketData,
    isStreamConnected: _sseConnected,
    connect: connectStream,
    disconnect: disconnectStream,
  } = useTokenStream(() => currentToken.value.address);

  // Merge SSE market data into local reactive state using the same delta-check
  // as refreshLive() to avoid spurious Vue reactivity updates.
  // The stream reports the market as soon as a trade moves it: take it, and reload the chart and
  // the open tab then rather than at the next poll (up to 30s on coarse timeframes).
  let streamRefresh: Promise<void> | null = null;
  watch(streamMarketData, (incoming) => {
    if (!incoming || !marketChanged(currentMarketData.value, incoming)) return;
    currentMarketData.value = incoming;
    const addr = currentToken.value.address;
    if (addr && !streamRefresh) {
      streamRefresh = refreshAfterTrade(addr).finally(() => (streamRefresh = null));
    }
  });

  /** Returns the poll interval in ms based on the currently selected chart resolution.
   * Coarser timeframes update less frequently — the candle bucket does not change
   * until the next period boundary anyway, so polling faster is pure waste.
   * When SSE is connected this poll loop only refreshes candlesticks + tab data,
   * NOT market price (that comes through the stream).
   */
  function getLivePollIntervalMs(): number {
    const res = selectedResolution.value;
    if (res <= 1) return 3_000; // 1-second chart — stay near-realtime
    if (res <= 60) return 5_000; // 1-minute chart
    if (res <= 300) return 15_000; // 5-minute chart
    return 30_000; // 15m / 1h / 4h / 1d — coarse; save server load
  }

  async function refreshLive() {
    if (livePollActive) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    if (tokenLoading.value || !currentToken.value.address) return;
    const addr = currentToken.value.address;

    livePollActive = true;
    liveAbort?.abort();
    liveAbort = new AbortController();
    const { signal } = liveAbort;

    try {
      try {
        const env = await apiFetch<{
          success: boolean;
          data: { token: LaunchedTokenEntity; marketData: TokenMarketData };
        }>(`/api/tokens/${addr}`, { signal });
        const incoming = env.data?.marketData;
        if (env.success && incoming && addr === currentToken.value.address) {
          if (marketChanged(currentMarketData.value, incoming)) currentMarketData.value = incoming;
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
      await refreshAfterTrade(addr);
    } finally {
      livePollActive = false;
    }
  }

  /** The chart and the open tab (trades, top traders or holders) again, without spinners. */
  async function refreshAfterTrade(addr: string) {
    const tabFetch =
      activeBottomTab.value === 'trades'
        ? fetchTrades(addr, true)
        : activeBottomTab.value === 'top-traders'
          ? fetchTopTraders(addr, true)
          : activeBottomTab.value === 'holders'
            ? fetchHolders(addr, true)
            : Promise.resolve();
    await Promise.allSettled([fetchCandlesticks(addr, selectedResolution.value, true), tabFetch]);
  }

  function scheduleNextLivePoll() {
    if (livePollTimer) {
      clearTimeout(livePollTimer);
      livePollTimer = null;
    }
    if (typeof document !== 'undefined' && document.hidden) return;
    livePollTimer = setTimeout(async () => {
      await refreshLive();
      scheduleNextLivePoll();
    }, getLivePollIntervalMs());
  }

  function onVisibility() {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      if (livePollTimer) {
        clearTimeout(livePollTimer);
        livePollTimer = null;
      }
      liveAbort?.abort();
      livePollActive = false;
    } else {
      refreshLive().then(() => scheduleNextLivePoll());
    }
  }

  async function fetchTrades(address: string, silent = false) {
    if (!silent) tradesLoading.value = true;
    try {
      const envelope = await apiFetch<{ success: boolean; data: LiveTrade[] }>(
        `/api/tokens/${address}/trades?limit=50`,
      );
      if (envelope.success && Array.isArray(envelope.data)) {
        replaceIfChanged(trades, envelope.data);
      } else if (!silent) {
        trades.value = [];
      }
    } catch {
      if (!silent) trades.value = [];
    } finally {
      if (!silent) tradesLoading.value = false;
    }
  }

  async function fetchHolders(address: string, silent = false) {
    if (!silent) holdersLoading.value = true;
    try {
      const envelope = await apiFetch<{ success: boolean; data: TokenHolder[] }>(
        `/api/tokens/${address}/holders?limit=50`,
      );
      if (envelope.success && Array.isArray(envelope.data)) {
        replaceIfChanged(holders, envelope.data);
      } else if (!silent) {
        holders.value = [];
      }
    } catch {
      if (!silent) holders.value = [];
    } finally {
      if (!silent) holdersLoading.value = false;
    }
  }

  async function fetchTopTraders(address: string, silent = false) {
    if (!silent) topTradersLoading.value = true;
    try {
      const envelope = await apiFetch<{ success: boolean; data: typeof topTraders.value }>(
        `/api/tokens/${address}/top-traders?limit=20`,
      );
      if (envelope.success && Array.isArray(envelope.data)) {
        replaceIfChanged(topTraders, envelope.data);
      } else if (!silent) {
        topTraders.value = [];
      }
    } catch {
      if (!silent) topTraders.value = [];
    } finally {
      if (!silent) topTradersLoading.value = false;
    }
  }

  async function fetchDevActivity(address: string) {
    try {
      const envelope = await apiFetch<{ success: boolean; data: typeof devInfo.value }>(
        `/api/tokens/${address}/dev-activity`,
      );
      if (envelope.success && envelope.data) devInfo.value = envelope.data;
    } catch {
      // non-blocking
    }
  }

  // -----------------------------------------------------------------------
  // Multi-Timeframe Candlestick Engine (1m, 5m, 15m, 1h, 4h, 1d)
  // Continuous timeline from token release to now
  // -----------------------------------------------------------------------
  async function fetchCandlesticks(address: string, resolutionSeconds = 1, silent = false) {
    // silent=true → live poll: no loading spinner, only merge last 1-2 candles in-place
    // silent=false → full load: show spinner, replace entire dataset
    type CandleRow = {
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    };

    function parseCandleRow(c: {
      timestamp: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume?: number;
    }): CandleRow {
      return {
        time: Math.floor(c.timestamp / 1000),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume ?? 0,
      };
    }

    function patchLivePrice(rows: CandleRow[], priceUsd: number, resolution: number): void {
      // Patch the current open bucket with live price without creating a new array reference
      if (rows.length === 0 || priceUsd <= 0) return;
      const nowSec = Math.floor(Date.now() / 1000);
      const currentBucket = Math.floor(nowSec / resolution) * resolution;
      const last = rows[rows.length - 1];
      if (last.time === currentBucket) {
        last.close = priceUsd;
        last.high = Math.max(last.high, priceUsd);
        last.low = Math.min(last.low, priceUsd);
      } else if (currentBucket > last.time) {
        rows.push({
          time: currentBucket,
          open: last.close,
          high: Math.max(last.close, priceUsd),
          low: Math.min(last.close, priceUsd),
          close: priceUsd,
          volume: 0,
        });
      }
    }

    try {
      if (!silent) candlesLoading.value = true;
      const envelope = await apiFetch<{
        success: boolean;
        data: Array<{
          timestamp: number;
          open: number;
          high: number;
          low: number;
          close: number;
          volume?: number;
        }>;
      }>(`/api/tokens/${address}/ohlcv?resolution=${resolutionSeconds}&fillGaps=true`);
      if (resolutionSeconds !== selectedResolution.value) return; // Discard stale timeframe response

      if (envelope.success && Array.isArray(envelope.data) && envelope.data.length > 0) {
        const incoming: CandleRow[] = envelope.data.map(parseCandleRow);
        const livePrice = currentMarketData.value.priceUsd;
        patchLivePrice(incoming, livePrice, resolutionSeconds);

        if (silent && candlestickData.value.length > 0) {
          // Live poll: take every bar that is new or changed, not only the last ones. A trade is
          // indexed a few seconds after its block, when its bar may no longer be among the last.
          const merged = mergeCandles(candlestickData.value, incoming);
          if (merged) candlestickData.value = merged;
        } else {
          // Full replace on initial load or timeframe change
          candlestickData.value = incoming;
        }
        return;
      }

      // No trade data: synthesize a baseline from creation price
      if (!silent && currentMarketData.value.priceUsd > 0) {
        const tokenCreatedSec = currentToken.value.createdAt
          ? Math.floor(currentToken.value.createdAt / 1000)
          : Math.floor(Date.now() / 1000) - 3600;
        const nowSec = Math.floor(Date.now() / 1000);
        const start = Math.floor(tokenCreatedSec / resolutionSeconds) * resolutionSeconds;
        const end = Math.floor(nowSec / resolutionSeconds) * resolutionSeconds;
        const price = currentMarketData.value.priceUsd;

        const baseline: CandleRow[] = [
          { time: start, open: price, high: price, low: price, close: price, volume: 0 },
        ];
        if (end > start) {
          baseline.push({
            time: end,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: 0,
          });
        }
        candlestickData.value = baseline;
        return;
      }

      if (!silent) candlestickData.value = [];
    } catch {
      if (!silent) candlestickData.value = [];
    } finally {
      if (!silent) candlesLoading.value = false;
    }
  }

  async function changeResolution(seconds: number) {
    if (seconds === selectedResolution.value) return;
    selectedResolution.value = seconds;
    try {
      localStorage.setItem(TIMEFRAME_STORAGE_KEY, String(seconds));
    } catch {
      // Ignore storage errors
    }
    // Clear stale data immediately so TradingChart receives empty array → full reset on new data
    candlestickData.value = [];
    candlesLoading.value = true;
    await fetchCandlesticks(currentToken.value.address, seconds);
  }

  /** Starts live updates: the SSE stream first, the poll loop as fallback for candles and tabs. */
  function startLive(): void {
    connectStream();
    scheduleNextLivePoll();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
  }

  /** Stops live updates (SSE before the poll loop, so no stale frame arrives after teardown). */
  function stopLive(): void {
    disconnectStream();
    if (livePollTimer) {
      clearTimeout(livePollTimer);
      livePollTimer = null;
    }
    liveAbort?.abort();
    livePollActive = false;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
    }
  }

  return {
    startLive,
    stopLive,
    burnedInfo,
    candlesLoading,
    candlestickData,
    changeResolution,
    devHoldingPercent,
    fetchCandlesticks,
    fetchDevActivity,
    fetchHolders,
    fetchTopTraders,
    fetchTrades,
    holders,
    holdersLoading,
    isHolderAddress,
    priceFlash,
    primaryFigureMode,
    primaryFigureValue,
    quoteAssetPriceUsd,
    resolutions,
    secondaryFigureValue,
    selectedResolution,
    toggleHeaderFigure,
    top10HoldingPercent,
    topTraders,
    topTradersLoading,
    trades,
    tradesLoading,
    triggerPriceFlash,
  };
}

export type UseTradeMarket = ReturnType<typeof useTradeMarket>;
