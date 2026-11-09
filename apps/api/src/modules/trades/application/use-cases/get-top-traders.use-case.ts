import type { Address } from 'viem';
import { FALLBACK_ETH_PRICE_USD, resolveTokenNetwork } from '@goton/shared-types';
import type { TradeRepositoryPort } from '../../domain/ports/trade-repository.port';
import type { TokenRepositoryPort } from '../../../../core/ports/token.repository.port';
import type { PriceFeedPort } from '../../../../core/ports/price-feed.port';
import type { TopTraderItem } from '../../domain/entities/trade.entity';
import { assertAddress } from '../../../../core/errors/app-error';

interface CacheEntry {
  data: TopTraderItem[];
  timestamp: number;
  latestTradeId: string | undefined;
}

/** Trades read per page, and the most a leaderboard reads in all. */
const PAGE = 1000;
export const TOP_TRADERS_MAX_TRADES = 50_000;
/** Most tokens memoized; any valid address is a key, so the memo must not grow without bound. */
export const TOP_TRADERS_CACHE_SIZE = 500;

export class GetTopTradersUseCase {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly tradeRepository: TradeRepositoryPort,
    private readonly tokenRepository: TokenRepositoryPort,
    private readonly priceFeed: PriceFeedPort,
  ) {}

  async execute(address: string, limit = 20): Promise<TopTraderItem[]> {
    assertAddress(address);

    const cleanAddress = address.toLowerCase();
    const token = await this.tokenRepository.findByAddress(address as Address);
    const devAddress = (token?.deployer || '').toLowerCase();
    const [latest] = await this.tradeRepository.getTrades(address as Address, 1, 0);

    // Return memoized top-traders if no trade landed since and within 3s TTL
    const cached = this.cache.get(cleanAddress);
    if (cached && cached.latestTradeId === latest?.id && Date.now() - cached.timestamp < 3000) {
      return cached.data.slice(0, limit);
    }

    // Every trade, not the newest 500: a trader whose buys fell out of that window showed their
    // later sells as pure profit (and a "smart degen" tag and a sold-out position they never had).
    const trades = [];
    for (let offset = 0; offset < TOP_TRADERS_MAX_TRADES; offset += PAGE) {
      const page = await this.tradeRepository.getTrades(address as Address, PAGE, offset);
      trades.push(...page);
      if (page.length < PAGE) break;
    }

    const traderMap = new Map<
      string,
      {
        buyUsd: number;
        sellUsd: number;
        buyTokens: number;
        sellTokens: number;
        trades: number;
        firstBuyTs: number;
        firstBuyPrice: number;
      }
    >();

    // Each chain prices trades in its own quote asset (ETH, or USDC at $1).
    let quotePrice: number;
    try {
      quotePrice = await this.priceFeed.getQuoteAssetPriceUsd(resolveTokenNetwork(token).chainId);
    } catch {
      quotePrice = FALLBACK_ETH_PRICE_USD; // Resilient fallback: only the floating ETH quote can fail
    }

    // Trades are sorted newest first, sort chronological to determine first buy
    const chronologicalTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);

    for (const t of chronologicalTrades) {
      const trader = t.trader.toLowerCase();
      const cur = traderMap.get(trader) || {
        buyUsd: 0,
        sellUsd: 0,
        buyTokens: 0,
        sellTokens: 0,
        trades: 0,
        firstBuyTs: t.timestamp,
        firstBuyPrice: 0,
      };

      // At the quote's USD price when the trade happened (priceUsd / priceQuote), not today's.
      const quote = parseFloat(t.wethAmount || '0') || 0;
      const rate =
        t.priceQuote && t.priceQuote > 0 && t.priceUsd > 0 ? t.priceUsd / t.priceQuote : quotePrice;
      const valUsd = quote * rate;
      let tokenAmount = parseFloat(t.tokenAmount || '0');
      if (isNaN(tokenAmount) || tokenAmount < 0) {
        tokenAmount = 0;
      }

      if (t.isBuy) {
        cur.buyUsd += valUsd;
        cur.buyTokens += tokenAmount;
        if (cur.firstBuyPrice === 0 && tokenAmount > 0) {
          cur.firstBuyPrice = valUsd / tokenAmount;
          cur.firstBuyTs = t.timestamp;
        }
      } else {
        cur.sellUsd += valUsd;
        cur.sellTokens += tokenAmount;
      }
      cur.trades += 1;
      traderMap.set(trader, cur);
    }

    // What is still held counts at today's price: sell - buy alone put every holder who had not
    // sold at a loss of everything they bought, and tagged no holder as a smart trader.
    const priceUsd =
      (await this.tokenRepository.getMarketData?.(address as Address).catch(() => null))
        ?.priceUsd ?? 0;

    const list = Array.from(traderMap.entries()).map(([traderAddr, stats]) => {
      const isDev = traderAddr === devAddress;
      const heldTokens = Math.max(0, stats.buyTokens - stats.sellTokens);
      const profitUsd = Math.round(stats.sellUsd + heldTokens * priceUsd - stats.buyUsd);
      let walletTag = 'trader';
      if (isDev) walletTag = 'dev';
      else if (profitUsd > 500) walletTag = 'smart_degen';
      else if (stats.trades >= 5) walletTag = 'active';

      const avgCostUsd = stats.buyTokens > 0 ? stats.buyUsd / stats.buyTokens : 0;
      const remainingTokens = Math.max(0, stats.buyTokens - stats.sellTokens);

      let positionStatus: 'holding' | 'partial' | 'clean_all' = 'holding';
      if (stats.sellTokens > 0) {
        if (remainingTokens <= 0.0001) {
          positionStatus = 'clean_all';
        } else {
          positionStatus = 'partial';
        }
      }

      return {
        address: traderAddr,
        // Cents, not whole dollars: a $0.24 memecoin buy rounded to $0.
        buyVolumeUsd: Math.round(stats.buyUsd * 100) / 100,
        sellVolumeUsd: Math.round(stats.sellUsd * 100) / 100,
        totalTrades: stats.trades,
        profitUsd,
        isDev,
        walletTag,
        firstBuyTimestamp: stats.firstBuyTs,
        firstBuyPriceUsd: stats.firstBuyPrice,
        avgCostUsd,
        holdingAmountTokens: remainingTokens.toFixed(2),
        positionStatus,
      };
    });

    // Deterministic tie-breaker sorting: volume -> totalTrades -> address
    list.sort((a, b) => {
      const volA = a.buyVolumeUsd + a.sellVolumeUsd;
      const volB = b.buyVolumeUsd + b.sellVolumeUsd;
      if (volB !== volA) return volB - volA;
      if (b.totalTrades !== a.totalTrades) return b.totalTrades - a.totalTrades;
      return a.address.localeCompare(b.address);
    });

    this.cache.delete(cleanAddress);
    if (this.cache.size >= TOP_TRADERS_CACHE_SIZE) {
      // Oldest first: a Map iterates in insertion order and an entry is reinserted on refresh.
      this.cache.delete(this.cache.keys().next().value!);
    }
    this.cache.set(cleanAddress, {
      data: list,
      timestamp: Date.now(),
      latestTradeId: latest?.id,
    });

    return list.slice(0, limit);
  }
}
