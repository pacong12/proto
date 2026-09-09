import { ApiEnvelope, TradeEventEntity, CandlestickEntity, ok, err } from '@proto/shared-types';
import {
  GetTokensUseCase,
  TokenWithMarketData,
} from '../application/use-cases/get-tokens.use-case';
import {
  GetTokenByAddressUseCase,
  TokenDetailResult,
} from '../application/use-cases/get-token-by-address.use-case';
import { TokenRepositoryPort } from '../domain/ports/token.repository.port';

export class TokenController {
  constructor(
    private readonly getTokensUseCase: GetTokensUseCase,
    private readonly getTokenByAddressUseCase: GetTokenByAddressUseCase,
    private readonly tokenRepository: TokenRepositoryPort,
  ) {}

  async listTokens(
    limit = 50,
    offset = 0,
    version?: 'v1' | 'v2',
    deployer?: string,
  ): Promise<ApiEnvelope<TokenWithMarketData[]>> {
    try {
      let result = await this.getTokensUseCase.execute(limit, offset);
      if (version) {
        result = result.filter((t) => (t.token.version ?? 'v1') === version);
      }
      if (deployer) {
        const target = deployer.toLowerCase();
        result = result.filter((t) => t.token.deployer.toLowerCase() === target);
      }
      return ok(result);
    } catch (error) {
      return err('FETCH_TOKENS_FAILED', (error as Error).message);
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
      const token = await this.tokenRepository.findByAddress(address as `0x${string}`);
      const devAddress = (token?.deployer || '').toLowerCase();
      const trades = await this.tokenRepository.getTrades(address as `0x${string}`, 500, 0);

      const traderMap = new Map<
        string,
        {
          buyUsd: number;
          sellUsd: number;
          buyTokens: bigint;
          sellTokens: bigint;
          trades: number;
          firstBuyTs: number;
          firstBuyPrice: number;
        }
      >();

      const ethPrice = 2500;
      // Trades are sorted newest first, sort chronological to determine first buy
      const chronologicalTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);

      for (const t of chronologicalTrades) {
        const trader = t.trader.toLowerCase();
        const cur = traderMap.get(trader) || {
          buyUsd: 0,
          sellUsd: 0,
          buyTokens: 0n,
          sellTokens: 0n,
          trades: 0,
          firstBuyTs: t.timestamp,
          firstBuyPrice: 0,
        };

        const valUsd = parseFloat(t.wethAmount || '0') * ethPrice;
        let tokenAmountWei = 0n;
        try {
          tokenAmountWei = BigInt(t.tokenAmount || '0');
        } catch {
          tokenAmountWei = 0n;
        }

        if (t.isBuy) {
          cur.buyUsd += valUsd;
          cur.buyTokens += tokenAmountWei;
          if (cur.firstBuyPrice === 0 && tokenAmountWei > 0n) {
            const tokens = Number(tokenAmountWei) / 1e18;
            cur.firstBuyPrice = tokens > 0 ? valUsd / tokens : 0;
            cur.firstBuyTs = t.timestamp;
          }
        } else {
          cur.sellUsd += valUsd;
          cur.sellTokens += tokenAmountWei;
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

        const totalBuyTokensNum = Number(stats.buyTokens) / 1e18;
        const avgCostUsd = totalBuyTokensNum > 0 ? stats.buyUsd / totalBuyTokensNum : 0;

        const remainingTokens =
          stats.buyTokens > stats.sellTokens ? stats.buyTokens - stats.sellTokens : 0n;

        let positionStatus: 'holding' | 'partial' | 'clean_all' = 'holding';
        if (stats.sellTokens > 0n) {
          if (remainingTokens === 0n) {
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
          holdingAmountTokens: (Number(remainingTokens) / 1e18).toFixed(2),
          positionStatus,
        };
      });

      list.sort((a, b) => b.buyVolumeUsd + b.sellVolumeUsd - (a.buyVolumeUsd + a.sellVolumeUsd));
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
    resolutionSeconds = 60,
  ): Promise<ApiEnvelope<CandlestickEntity[]>> {
    if (!address.startsWith('0x') || address.length !== 42) {
      return err('INVALID_ADDRESS', 'Token address must be a valid 42-character hex string');
    }

    try {
      const candles = await this.tokenRepository.getCandlesticks(
        address as `0x${string}`,
        resolutionSeconds,
      );
      return ok(candles);
    } catch (error) {
      return err('FETCH_CANDLESTICKS_FAILED', (error as Error).message);
    }
  }
}
