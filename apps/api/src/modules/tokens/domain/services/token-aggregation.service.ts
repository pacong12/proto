import { parseUnits } from 'viem';
import { LaunchedTokenEntity, TradeEventEntity, CandlestickEntity } from '@goton/shared-types';

export interface RawTradeForCandles {
  timestamp: number;
  priceUsd: number | string;
  wethAmount: string;
}

export interface HolderItem {
  address: string;
  balance: string;
  percent: number;
}

export interface AggregateCandlesticksOptions {
  startTime?: number; // token creation / release timestamp (ms)
  endTime?: number; // current timestamp (ms), defaults to Date.now()
  fillGaps?: boolean; // fill gaps between release and now
  maxCandles?: number; // max bars to return (default 1000)
  fallbackPrice?: number;
}

export function aggregateCandlesticks(
  trades: RawTradeForCandles[],
  resolutionSeconds = 60,
  options?: AggregateCandlesticksOptions,
): CandlestickEntity[] {
  const bucketDurationMs = resolutionSeconds * 1000;
  const buckets = new Map<number, RawTradeForCandles[]>();

  let earliestTradeTime = trades.length > 0 ? trades[0].timestamp : undefined;
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
    const candles: CandlestickEntity[] = [];
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
  // When options.startTime is provided (token creation time), never synthesize phantom bars
  // prior to the token's on-chain birth. Only pad visual context if no explicit release time is known.
  if (!options.startTime && (endBucket - startBucket) / bucketDurationMs < 30) {
    startBucket = Math.max(0, endBucket - 30 * bucketDurationMs);
  }
  if ((endBucket - startBucket) / bucketDurationMs > maxBars) {
    startBucket = endBucket - maxBars * bucketDurationMs;
  }

  // Determine baseline price
  let currentPrice = options.fallbackPrice ?? 0;
  if (trades.length > 0) {
    const sortedAll = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    currentPrice = Number(sortedAll[0].priceUsd);
  }

  if (currentPrice <= 0 && buckets.size === 0) {
    return [];
  }

  const candles: CandlestickEntity[] = [];
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

  return candles;
}

function toBaseUnits(amount: string, decimals: number): bigint {
  try {
    return parseUnits(amount.trim(), decimals);
  } catch {
    return 0n;
  }
}

export function computeHoldersDistribution(
  token: LaunchedTokenEntity | null,
  trades: TradeEventEntity[],
  limit = 50,
): HolderItem[] {
  let totalSupply = 1_000_000_000n * 10n ** 18n;
  if (token?.totalSupply) {
    try {
      totalSupply = BigInt(token.totalSupply);
    } catch {
      totalSupply = 1_000_000_000n * 10n ** 18n;
    }
  }

  const poolAddress = token?.poolAddress || '0x000000000000000000000000000000000000dEaD';
  const deployerAddress = token?.deployer || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

  const traderBalances = new Map<string, bigint>();
  for (const trade of trades) {
    const trader = trade.trader.toLowerCase();
    if (trader === poolAddress.toLowerCase()) continue;

    // API-01: trades store human-readable token amounts (e.g. "204857030.2081"); convert to the
    // token's base units so they are comparable with totalSupply.
    const amount = toBaseUnits(trade.tokenAmount, token?.decimals ?? 18);

    const cur = traderBalances.get(trader) ?? 0n;
    if (trade.isBuy) {
      traderBalances.set(trader, cur + amount);
    } else {
      traderBalances.set(trader, cur > amount ? cur - amount : 0n);
    }
  }

  // The creator's launch buy is indexed as a regular trade, so it is already in traderBalances.
  // (initialBuyAmount is the quote amount paid, not a token balance.)
  const activeTraders = Array.from(traderBalances.entries())
    .filter(([addr, bal]) => bal > 0n && addr !== deployerAddress.toLowerCase())
    .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0));

  const totalTraderTokens = activeTraders.reduce((sum, [, bal]) => sum + bal, 0n);
  const holders: HolderItem[] = [];

  const totalDeployerBalance = traderBalances.get(deployerAddress.toLowerCase()) ?? 0n;
  const nonPoolTotal = totalDeployerBalance + totalTraderTokens;
  const poolBalance = totalSupply > nonPoolTotal ? totalSupply - nonPoolTotal : 0n;

  holders.push({
    address: poolAddress,
    balance: poolBalance.toString(),
    percent: Number((poolBalance * 10000n) / totalSupply) / 100,
  });

  if (totalDeployerBalance > 0n) {
    holders.push({
      address: deployerAddress,
      balance: totalDeployerBalance.toString(),
      percent: Number((totalDeployerBalance * 10000n) / totalSupply) / 100,
    });
  }

  for (const [addr, bal] of activeTraders) {
    holders.push({
      address: addr,
      balance: bal.toString(),
      percent: Number((bal * 10000n) / totalSupply) / 100,
    });
  }

  return holders.slice(0, limit);
}
