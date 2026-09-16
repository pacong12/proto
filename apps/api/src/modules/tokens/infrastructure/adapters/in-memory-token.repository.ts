import {
  LaunchedTokenEntity,
  TokenMarketData,
  TradeEventEntity,
  CandlestickEntity,
} from '@proto/shared-types';
import { TokenRepositoryPort } from '../../domain/ports/token.repository.port';
import {
  aggregateCandlesticks,
  computeHoldersDistribution,
} from '../../domain/services/token-aggregation.service';

export class InMemoryTokenRepository implements TokenRepositoryPort {
  private tokens = new Map<string, LaunchedTokenEntity>();
  private marketData = new Map<string, TokenMarketData>();
  private trades = new Map<string, TradeEventEntity[]>();

  async save(token: LaunchedTokenEntity): Promise<void> {
    this.tokens.set(token.address.toLowerCase(), token);
  }

  async findByAddress(address: `0x${string}`): Promise<LaunchedTokenEntity | null> {
    return this.tokens.get(address.toLowerCase()) ?? null;
  }

  async findAll(limit = 50, offset = 0): Promise<LaunchedTokenEntity[]> {
    const all = Array.from(this.tokens.values()).reverse();
    return all.slice(offset, offset + limit);
  }

  async saveMarketData(data: TokenMarketData): Promise<void> {
    this.marketData.set(data.address.toLowerCase(), data);
  }

  async getMarketData(address: `0x${string}`): Promise<TokenMarketData | null> {
    return this.marketData.get(address.toLowerCase()) ?? null;
  }

  async saveTrade(trade: TradeEventEntity): Promise<void> {
    const key = trade.tokenAddress.toLowerCase();
    const existing = this.trades.get(key) ?? [];
    existing.unshift(trade);
    this.trades.set(key, existing);
  }

  async getTrades(
    tokenAddress: `0x${string}`,
    limit = 50,
    offset = 0,
  ): Promise<TradeEventEntity[]> {
    const all = this.trades.get(tokenAddress.toLowerCase()) ?? [];
    return all.slice(offset, offset + limit);
  }

  async getCandlesticks(
    tokenAddress: `0x${string}`,
    resolutionSeconds = 60,
  ): Promise<CandlestickEntity[]> {
    const trades = this.trades.get(tokenAddress.toLowerCase()) ?? [];
    return aggregateCandlesticks(trades, resolutionSeconds);
  }

  async getHolders(
    tokenAddress: string,
    limit = 50,
  ): Promise<Array<{ address: string; balance: string; percent: number }>> {
    const token = await this.findByAddress(tokenAddress.toLowerCase() as `0x${string}`);
    const trades = await this.getTrades(tokenAddress.toLowerCase() as `0x${string}`, 1000);
    return computeHoldersDistribution(token, trades, limit);
  }

  async getRecentTrades(limit = 50): Promise<TradeEventEntity[]> {
    const all = Array.from(this.trades.values()).flat();
    all.sort((a, b) => b.timestamp - a.timestamp);
    return all.slice(0, limit);
  }

  async findTradeByHash(txHash: string): Promise<TradeEventEntity | null> {
    const hash = txHash.toLowerCase();
    for (const list of this.trades.values()) {
      const match = list.find((t) => t.transactionHash.toLowerCase() === hash);
      if (match) return match;
    }
    return null;
  }
}
