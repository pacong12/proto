import {
  LaunchedTokenEntity,
  TokenMarketData,
  TradeEventEntity,
  CandlestickEntity,
} from '@proto/shared-types';
import { TokenRepositoryPort } from '../../domain/ports/token.repository.port';

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
    if (trades.length === 0) return [];

    const buckets = new Map<number, TradeEventEntity[]>();
    for (const trade of trades) {
      const bucketTime =
        Math.floor(trade.timestamp / (resolutionSeconds * 1000)) * (resolutionSeconds * 1000);
      const list = buckets.get(bucketTime) ?? [];
      list.push(trade);
      buckets.set(bucketTime, list);
    }

    const candles: CandlestickEntity[] = [];
    for (const [timestamp, bucketTrades] of buckets.entries()) {
      const sorted = [...bucketTrades].sort((a, b) => a.timestamp - b.timestamp);
      const prices = sorted.map((t) => t.priceUsd);
      const volume = sorted.reduce((sum, t) => sum + parseFloat(t.wethAmount), 0);

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

  async getHolders(
    tokenAddress: string,
    limit = 50,
  ): Promise<Array<{ address: string; balance: string; percent: number }>> {
    const token = await this.findByAddress(tokenAddress.toLowerCase() as `0x${string}`);
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
    const trades = await this.getTrades(tokenAddress.toLowerCase() as `0x${string}`, 1000);

    const traderBalances = new Map<string, bigint>();
    for (const trade of trades) {
      const trader = trade.trader.toLowerCase();
      if (trader === poolAddress.toLowerCase()) continue;

      let amount = 0n;
      try {
        amount = BigInt(trade.tokenAmount);
      } catch {
        amount = BigInt(Math.floor(Number(trade.tokenAmount) || 0));
      }

      const cur = traderBalances.get(trader) ?? 0n;
      if (trade.isBuy) {
        traderBalances.set(trader, cur + amount);
      } else {
        traderBalances.set(trader, cur > amount ? cur - amount : 0n);
      }
    }

    let deployerInitial = 0n;
    if (token?.initialBuyAmount) {
      try {
        const parsed = BigInt(token.initialBuyAmount);
        if (parsed > 0n) deployerInitial = parsed;
      } catch {
        // ignore invalid initial buy amount
      }
    }
    const activeTraders = Array.from(traderBalances.entries())
      .filter(([addr, bal]) => bal > 0n && addr !== deployerAddress.toLowerCase())
      .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0));

    const totalTraderTokens = activeTraders.reduce((sum, [, bal]) => sum + bal, 0n);
    const holders: Array<{ address: string; balance: string; percent: number }> = [];

    if (activeTraders.length === 0 || totalTraderTokens === 0n) {
      const poolBalance =
        totalSupply > deployerInitial ? totalSupply - deployerInitial : totalSupply;
      const poolPercent = Number((poolBalance * 10000n) / totalSupply) / 100;
      holders.push({
        address: poolAddress,
        balance: poolBalance.toString(),
        percent: poolPercent,
      });

      const deployerPercent = Number((deployerInitial * 10000n) / totalSupply) / 100;
      holders.push({
        address: deployerAddress,
        balance: deployerInitial.toString(),
        percent: deployerPercent,
      });
    } else {
      const deployerTradeBal = traderBalances.get(deployerAddress.toLowerCase()) ?? 0n;
      const totalDeployerBalance = deployerInitial + deployerTradeBal;
      const deployerPercent = Number((totalDeployerBalance * 10000n) / totalSupply) / 100;

      const nonPoolTotal = totalDeployerBalance + totalTraderTokens;
      const poolBalance = totalSupply > nonPoolTotal ? totalSupply - nonPoolTotal : 0n;
      const poolPercent = Number((poolBalance * 10000n) / totalSupply) / 100;

      holders.push({
        address: poolAddress,
        balance: poolBalance.toString(),
        percent: poolPercent,
      });

      holders.push({
        address: deployerAddress,
        balance: totalDeployerBalance.toString(),
        percent: deployerPercent,
      });

      for (const [addr, bal] of activeTraders) {
        const pct = Number((bal * 10000n) / totalSupply) / 100;
        holders.push({
          address: addr,
          balance: bal.toString(),
          percent: pct,
        });
      }
    }

    return holders.slice(0, limit);
  }
}
