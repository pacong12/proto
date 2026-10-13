import {
  ApiEnvelope,
  TradeEventEntity,
  CandlestickEntity,
  ok,
  err,
  ARC_CHAIN,
} from '@proto/shared-types';
import {
  GetTokensUseCase,
  TokenWithMarketData,
} from '../application/use-cases/get-tokens.use-case';
import {
  GetTokenByAddressUseCase,
  TokenDetailResult,
} from '../application/use-cases/get-token-by-address.use-case';
import { TokenRepositoryPort } from '../domain/ports/token.repository.port';
import { PriceFeedPort } from '../domain/ports/price-feed.port';

export class TokenController {
  private readonly topTradersCache = new Map<
    string,
    {
      data: Array<{
        address: string;
        buyVolumeUsd: number;
        sellVolumeUsd: number;
        totalTrades: number;
        profitUsd: number;
        isDev: boolean;
        walletTag: string;
        firstBuyTimestamp: number;
        firstBuyPriceUsd: number;
        avgCostUsd: number;
        holdingAmountTokens: string;
        positionStatus: 'holding' | 'partial' | 'clean_all';
      }>;
      timestamp: number;
      tradeCount: number;
    }
  >();

  constructor(
    private readonly getTokensUseCase: GetTokensUseCase,
    private readonly getTokenByAddressUseCase: GetTokenByAddressUseCase,
    private readonly tokenRepository: TokenRepositoryPort,
    private readonly priceFeed: PriceFeedPort,
  ) {}

  async listTokens(
    limit = 50,
    offset = 0,
    version?: 'v1' | 'v2',
    deployer?: string,
  ): Promise<ApiEnvelope<TokenWithMarketData[]>> {
    try {
      // Filters are pushed into SQL via getTokensUseCase.execute so LIMIT/OFFSET applies
      // after filtering, not before. JS post-filter was breaking pagination correctness.
      const result = await this.getTokensUseCase.execute(limit, offset, {
        version,
        deployer,
      });
      return ok(result);
    } catch (error) {
      return err('FETCH_TOKENS_FAILED', (error as Error).message);
    }
  }
  async getKingOfTheHill(): Promise<ApiEnvelope<TokenWithMarketData | null>> {
    try {
      const allTokens = await this.listTokens(100, 0, 'v2');
      if (!allTokens.success || !allTokens.data || allTokens.data.length === 0) {
        return ok(null);
      }

      // Filter active (ungraduated) curves and sort by graduationProgress descending, then marketCap
      const activeCurves = allTokens.data.filter((item) => !item.marketData?.isGraduated);

      if (activeCurves.length === 0) {
        // Fallback to top token if all are graduated
        return ok(allTokens.data[0]);
      }

      activeCurves.sort((a, b) => {
        const progA = a.marketData?.graduationProgress ?? 0;
        const progB = b.marketData?.graduationProgress ?? 0;
        if (progB !== progA) return progB - progA;
        return (b.marketData?.marketCapUsd ?? 0) - (a.marketData?.marketCapUsd ?? 0);
      });

      return ok(activeCurves[0]);
    } catch (error) {
      return err('KOTH_ERROR', (error as Error).message);
    }
  }

  async getToken(address: string): Promise<ApiEnvelope<TokenDetailResult>> {
    if (!address.startsWith('0x') || address.length !== 42) {
      return err('INVALID_ADDRESS', 'Token address must be a valid 42-character hex string');
    }

    try {
      const result = await this.getTokenByAddressUseCase.execute(address as `0x${string}`);
      if (!result) {
        return err('TOKEN_NOT_FOUND', `No token found for address ${address}`);
      }
      return ok(result);
    } catch (error) {
      return err('FETCH_TOKEN_FAILED', (error as Error).message);
    }
  }

  async getTrades(
    address: string,
    limit = 50,
    offset = 0,
  ): Promise<ApiEnvelope<TradeEventEntity[]>> {
    if (!address.startsWith('0x') || address.length !== 42) {
      return err('INVALID_ADDRESS', 'Token address must be a valid 42-character hex string');
    }

    try {
      const trades = await this.tokenRepository.getTrades(address as `0x${string}`, limit, offset);
      return ok(trades);
    } catch (error) {
      return err('FETCH_TRADES_FAILED', (error as Error).message);
    }
  }

  async getHolders(
    address: string,
    limit = 50,
  ): Promise<ApiEnvelope<Array<{ address: string; balance: string; percent: number }>>> {
    if (!address.startsWith('0x') || address.length !== 42) {
      return err('INVALID_ADDRESS', 'Token address must be a valid 42-character hex string');
    }

    try {
      const holders = await this.tokenRepository.getHolders(address, limit);
      return ok(holders);
    } catch (error) {
      return err('FETCH_HOLDERS_FAILED', (error as Error).message);
    }
  }
  async getTopTraders(
    address: string,
    limit = 20,
  ): Promise<
    ApiEnvelope<
      Array<{
        address: string;
        buyVolumeUsd: number;
        sellVolumeUsd: number;
        totalTrades: number;
        profitUsd: number;
        isDev: boolean;
        walletTag: string;
        firstBuyTimestamp: number;
        firstBuyPriceUsd: number;
        avgCostUsd: number;
        holdingAmountTokens: string;
        positionStatus: 'holding' | 'partial' | 'clean_all';
      }>
    >
  > {
    if (!address.startsWith('0x') || address.length !== 42) {
      return err('INVALID_ADDRESS', 'Token address must be a valid 42-character hex string');
    }

    try {
      const cleanAddress = address.toLowerCase();
      const token = await this.tokenRepository.findByAddress(address as `0x${string}`);
      const devAddress = (token?.deployer || '').toLowerCase();
      const trades = await this.tokenRepository.getTrades(address as `0x${string}`, 500, 0);

      // Return cached aggregation if trades count has not changed and TTL is active
      const cached = this.topTradersCache.get(cleanAddress);
      if (cached && cached.tradeCount === trades.length && Date.now() - cached.timestamp < 3000) {
        return ok(cached.data.slice(0, limit));
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
      const isArcToken =
        token?.pairedToken?.toLowerCase() === ARC_CHAIN.contracts.weth.toLowerCase();
      let quotePrice = 1.0;
      if (!isArcToken) {
        try {
          quotePrice = await this.priceFeed.getEthPriceUsd();
        } catch {
          quotePrice = 2500; // resilient fallback when oracle rate limits
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

      list.sort((a, b) => {
        const volA = a.buyVolumeUsd + a.sellVolumeUsd;
        const volB = b.buyVolumeUsd + b.sellVolumeUsd;
        if (volB !== volA) return volB - volA;
        if (b.totalTrades !== a.totalTrades) return b.totalTrades - a.totalTrades;
        return a.address.localeCompare(b.address);
      });

      this.topTradersCache.set(cleanAddress, {
        data: list,
        timestamp: Date.now(),
        tradeCount: trades.length,
      });

      return ok(list.slice(0, limit));
    } catch (error) {
      return err('FETCH_TOP_TRADERS_FAILED', (error as Error).message);
    }
  }

  async getDevActivity(address: string): Promise<
    ApiEnvelope<{
      creatorAddress: string;
      initialBuyEth: string;
      currentHoldPercent: number;
      creatorStatus: 'holding' | 'sold' | 'none';
      totalDevSoldEth: string;
      hasRenounced: boolean;
    }>
  > {
    if (!address.startsWith('0x') || address.length !== 42) {
      return err('INVALID_ADDRESS', 'Token address must be a valid 42-character hex string');
    }

    try {
      const token = await this.tokenRepository.findByAddress(address as `0x${string}`);
      const devAddr = token?.deployer || '0x0000000000000000000000000000000000000000';
      const trades = await this.tokenRepository.getTrades(address as `0x${string}`, 500, 0);

      let devSoldEth = 0;
      for (const t of trades) {
        if (t.trader.toLowerCase() === devAddr.toLowerCase() && !t.isBuy) {
          devSoldEth += parseFloat(t.wethAmount || '0');
        }
      }

      const holders = await this.tokenRepository.getHolders(address, 100);
      const devHolder = holders.find((h) => h.address.toLowerCase() === devAddr.toLowerCase());
      const holdPercent = devHolder ? devHolder.percent : 0;

      let creatorStatus: 'holding' | 'sold' | 'none' = 'none';
      if (holdPercent > 0.5) {
        creatorStatus = 'holding';
      } else if (devSoldEth > 0) {
        creatorStatus = 'sold';
      }

      return ok({
        creatorAddress: devAddr,
        initialBuyEth: token?.initialBuyAmount || '0.00',
        currentHoldPercent: holdPercent,
        creatorStatus,
        totalDevSoldEth: devSoldEth.toFixed(4),
        hasRenounced: false,
      });
    } catch (error) {
      return err('FETCH_DEV_ACTIVITY_FAILED', (error as Error).message);
    }
  }

  async getCandlesticks(
    address: string,
    resolutionSeconds = 1,
    fillGaps = false,
  ): Promise<ApiEnvelope<CandlestickEntity[]>> {
    if (!address.startsWith('0x') || address.length !== 42) {
      return err('INVALID_ADDRESS', 'Token address must be a valid 42-character hex string');
    }

    const VALID_RESOLUTIONS = [1, 60, 300, 900, 3600, 14400, 86400];
    if (!VALID_RESOLUTIONS.includes(resolutionSeconds)) {
      return err(
        'INVALID_RESOLUTION',
        `Resolution must be one of: ${VALID_RESOLUTIONS.join(', ')} seconds`,
      );
    }

    try {
      const candles = await this.tokenRepository.getCandlesticks(
        address as `0x${string}`,
        resolutionSeconds,
        fillGaps,
      );
      return ok(candles);
    } catch (error) {
      return err('FETCH_CANDLESTICKS_FAILED', (error as Error).message);
    }
  }
}
