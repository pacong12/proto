export interface RawTradeItem {
  timestamp: number;
  priceUsd: number | string;
  wethAmount: string;
}

export interface CandlestickBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandlestickAggregationOptions {
  startTime?: number; // token creation / release timestamp (ms)
  endTime?: number; // current timestamp (ms), defaults to Date.now()
  fillGaps?: boolean; // fill gaps between release and now
  maxCandles?: number; // max bars to return (default 1000)
  fallbackPrice?: number;
}

/**
 * Aggregates raw blockchain trade events into continuous, gap-filled OHLCV bars.
 * Zero-ghost-candle guarantee: when options.startTime is supplied, bars never
 * backfill prior to the token's real on-chain creation timestamp.
 */
export function aggregateCandlesticks(
  trades: RawTradeItem[],
  resolutionSeconds = 60,
  options?: CandlestickAggregationOptions,
): CandlestickBar[] {
  const bucketDurationMs = resolutionSeconds * 1000;
  const buckets = new Map<number, RawTradeItem[]>();

  let earliestTradeTime: number | undefined = trades.length > 0 ? trades[0].timestamp : undefined;
  for (const trade of trades) {
    if (earliestTradeTime === undefined || trade.timestamp < earliestTradeTime) {
      earliestTradeTime = trade.timestamp;
    }
    const bucketTime = Math.floor(trade.timestamp / bucketDurationMs) * bucketDurationMs;
    const list = buckets.get(bucketTime) ?? [];
    list.push(trade);
    buckets.set(bucketTime, list);
  }

  // Classic mode: if fillGaps not enabled, return pure trade buckets
  if (!options?.fillGaps) {
    if (!trades || trades.length === 0) return [];
    const candles: CandlestickBar[] = [];
    for (const [timestamp, bucketTrades] of buckets.entries()) {
      const sorted = [...bucketTrades].sort((a, b) => a.timestamp - b.timestamp);
      const prices = sorted.map((t) => Number(t.priceUsd));
      const volume = sorted.reduce((sum, t) => sum + parseFloat(t.wethAmount || '0'), 0);

      candles.push({
        timestamp,
        open: prices[0] ?? 0,
        high: Math.max(...prices),
        low: Math.min(...prices),
        close: prices[prices.length - 1] ?? 0,
        volume,
      });
    }
    return candles.sort((a, b) => a.timestamp - b.timestamp);
  }

  // Gap-filling mode: runs continuously from release/start to now
  const rawStart = options.startTime ?? earliestTradeTime ?? Date.now();
  const rawEnd = options.endTime ?? Date.now();
  let startBucket = Math.floor(rawStart / bucketDurationMs) * bucketDurationMs;
  const endBucket = Math.floor(rawEnd / bucketDurationMs) * bucketDurationMs;

  const maxBars = options.maxCandles ?? 1000;
  if (startBucket > endBucket) {
    startBucket = endBucket;
  }
  // When options.startTime is provided, never synthesize phantom bars
  // prior to the token's on-chain birth. Only pad visual context if no explicit release time is known.
  if (!options.startTime && (endBucket - startBucket) / bucketDurationMs < 30) {
    startBucket = Math.max(0, endBucket - 30 * bucketDurationMs);
  }
  if ((endBucket - startBucket) / bucketDurationMs > maxBars) {
    startBucket = endBucket - maxBars * bucketDurationMs;
  }

  // The price the first bar opens at: the last trade before it. A window that starts after the
  // token's first trades (only the newest maxBars are kept) must not open at the launch price,
  // which drew a jump from it to the real price.
  let currentPrice = options.fallbackPrice ?? 0;
  if (trades.length > 0) {
    const sortedAll = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    const before = sortedAll.filter((t) => t.timestamp < startBucket);
    currentPrice = Number((before[before.length - 1] ?? sortedAll[0]).priceUsd);
  }

  if (currentPrice <= 0 && buckets.size === 0) {
    return [];
  }

  const candles: CandlestickBar[] = [];
  for (let t = startBucket; t <= endBucket; t += bucketDurationMs) {
    const bucketTrades = buckets.get(t);
    if (bucketTrades && bucketTrades.length > 0) {
      const sorted = [...bucketTrades].sort((a, b) => a.timestamp - b.timestamp);
      const prices = sorted.map((item) => Number(item.priceUsd));
      const open = currentPrice > 0 ? currentPrice : (prices[0] ?? 0);
      const high = Math.max(open, ...prices);
      const low = Math.min(open, ...prices);
      const close = prices[prices.length - 1] ?? open;
      const volume = sorted.reduce((sum, item) => sum + parseFloat(item.wethAmount || '0'), 0);

      currentPrice = close;
      candles.push({
        timestamp: t,
        open,
        high,
        low,
        close,
        volume,
      });
    } else {
      // Flat candle at current price (zero volume)
      candles.push({
        timestamp: t,
        open: currentPrice,
        high: currentPrice,
        low: currentPrice,
        close: currentPrice,
        volume: 0,
      });
    }
  }

  return candles.sort((a, b) => a.timestamp - b.timestamp);
}
