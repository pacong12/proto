import type { Address } from 'viem';
import { ARC_CHAIN } from '@proto/shared-types';
import type { TradeRepositoryPort } from '../../domain/ports/trade-repository.port';
import type { TokenRepositoryPort } from '../../../tokens/domain/ports/token.repository.port';
import type { PriceFeedPort } from '../../../tokens/domain/ports/price-feed.port';
import type { TopTraderItem } from '../../domain/entities/trade.entity';
import { ValidationError } from '../../../../core/errors/app-error';

interface CacheEntry {
  data: TopTraderItem[];
  timestamp: number;
  tradeCount: number;
}

export class GetTopTradersUseCase {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly tradeRepository: TradeRepositoryPort,
    private readonly tokenRepository: TokenRepositoryPort,
    private readonly priceFeed: PriceFeedPort,
  ) {}

  async execute(address: string, limit = 20): Promise<TopTraderItem[]> {
    if (!address.startsWith('0x') || address.length !== 42) {
      throw new ValidationError(
        'Token address must be a valid 42-character hex string',
        'INVALID_ADDRESS',
      );
    }

    const cleanAddress = address.toLowerCase();
    const token = await this.tokenRepository.findByAddress(address as Address);
    const devAddress = (token?.deployer || '').toLowerCase();
    const trades = await this.tradeRepository.getTrades(address as Address, 500, 0);

    // Return memoized top-traders if trade count is unchanged and within 3s TTL
    const cached = this.cache.get(cleanAddress);
    if (cached && cached.tradeCount === trades.length && Date.now() - cached.timestamp < 3000) {
      return cached.data.slice(0, limit);
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

    // Multi-chain: Arc tokens use USDC quote (always $1.00)
    const isArcToken = token?.pairedToken?.toLowerCase() === ARC_CHAIN.contracts.weth.toLowerCase();
    let quotePrice = 1.0;
    if (!isArcToken) {
      try {
        quotePrice = await this.priceFeed.getEthPriceUsd();
      } catch {
        quotePrice = 2500; // Resilient fallback
      }
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

      const valUsd = parseFloat(t.wethAmount || '0') * quotePrice;
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

    const list = Array.from(traderMap.entries()).map(([traderAddr, stats]) => {
      const isDev = traderAddr === devAddress;
      const profitUsd = Math.round(stats.sellUsd - stats.buyUsd);
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
        buyVolumeUsd: Math.round(stats.buyUsd),
        sellVolumeUsd: Math.round(stats.sellUsd),
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

    this.cache.set(cleanAddress, {
      data: list,
      timestamp: Date.now(),
      tradeCount: trades.length,
    });

    return list.slice(0, limit);
  }
}
