import { Database } from 'bun:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LaunchedTokenEntity,
  TokenMarketData,
  TradeEventEntity,
  CandlestickEntity,
} from '@proto/shared-types';
import { TokenRepositoryPort } from '../../domain/ports/token.repository.port';

interface TokenRow {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  logo: string | null;
  description: string | null;
  socials_json: string | null;
  deployer: string;
  pairedToken: string;
  poolAddress: string;
  isToken0: number;
  poolFee: number;
  positionId: string;
  restrictionsEndBlock: string;
  launchBlock: string;
  createdAt: number;
  initialBuyAmount: string | null;
  tax_config_json: string | null;
}

interface TradeRow {
  id: string;
  tokenAddress: string;
  poolAddress: string;
  trader: string;
  isBuy: number;
  tokenAmount: string;
  wethAmount: string;
  priceUsd: number;
  blockNumber: string;
  transactionHash: string;
  timestamp: number;
}

interface MarketDataRow {
  address: string;
  priceInWeth: number;
  priceUsd: number;
  marketCapUsd: number;
  fdvUsd: number;
  pairedPrincipalWeth: string;
  graduationThresholdWeth: string;
  graduationProgress: number;
  isGraduated: number;
  volume24hUsd: number;
}

const currentDir =
  typeof import.meta.dir === 'string'
    ? import.meta.dir
    : path.dirname(fileURLToPath(import.meta.url));

const defaultDbPath =
  process.env.DB_PATH || path.resolve(currentDir, '../../../../../proto.sqlite');

export class SqliteTokenRepository implements TokenRepositoryPort {
  private db: Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? defaultDbPath;
    this.db = new Database(resolvedPath);
    this.initTables();
  }

  private initTables(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tokens (
        address TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        decimals INTEGER NOT NULL,
        totalSupply TEXT NOT NULL,
        logo TEXT,
        description TEXT,
        socials_json TEXT,
        deployer TEXT NOT NULL,
        pairedToken TEXT NOT NULL,
        poolAddress TEXT NOT NULL,
        isToken0 INTEGER NOT NULL,
        poolFee INTEGER NOT NULL,
        positionId TEXT NOT NULL,
        restrictionsEndBlock TEXT NOT NULL,
        launchBlock TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        initialBuyAmount TEXT,
        tax_config_json TEXT
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        tokenAddress TEXT NOT NULL,
        poolAddress TEXT NOT NULL,
        trader TEXT NOT NULL,
        isBuy INTEGER NOT NULL,
        tokenAmount TEXT NOT NULL,
        wethAmount TEXT NOT NULL,
        priceUsd REAL NOT NULL,
        blockNumber TEXT NOT NULL,
        transactionHash TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_trades_tokenAddress ON trades(tokenAddress);
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS market_data (
        address TEXT PRIMARY KEY,
        priceInWeth REAL NOT NULL,
        priceUsd REAL NOT NULL,
        marketCapUsd REAL NOT NULL,
        fdvUsd REAL NOT NULL,
        pairedPrincipalWeth TEXT NOT NULL,
        graduationThresholdWeth TEXT NOT NULL,
        graduationProgress REAL NOT NULL,
        isGraduated INTEGER NOT NULL,
        volume24hUsd REAL NOT NULL
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS candlesticks (
        tokenAddress TEXT NOT NULL,
        resolutionSeconds INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume REAL NOT NULL,
        PRIMARY KEY (tokenAddress, resolutionSeconds, timestamp)
      );
    `);
  }

  async save(token: LaunchedTokenEntity): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tokens (
        address, name, symbol, decimals, totalSupply, logo, description,
        socials_json, deployer, pairedToken, poolAddress, isToken0, poolFee,
        positionId, restrictionsEndBlock, launchBlock, createdAt, initialBuyAmount, tax_config_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      token.address,
      token.name,
      token.symbol,
      token.decimals,
      token.totalSupply,
      token.logo ?? '',
      token.description ?? '',
      JSON.stringify(token.socials ?? {}),
      token.deployer,
      token.pairedToken,
      token.poolAddress,
      token.isToken0 ? 1 : 0,
      token.poolFee,
      token.positionId.toString(),
      token.restrictionsEndBlock.toString(),
      token.launchBlock.toString(),
      token.createdAt,
      token.initialBuyAmount ?? null,
      token.taxConfig ? JSON.stringify(token.taxConfig) : null,
    );
  }

  async findByAddress(address: `0x${string}`): Promise<LaunchedTokenEntity | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM tokens WHERE LOWER(address) = LOWER(?) LIMIT 1
    `);
    const row = stmt.get(address) as TokenRow | null;
    if (!row) return null;
    return this.mapRowToToken(row);
  }

  async findAll(limit = 50, offset = 0): Promise<LaunchedTokenEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM tokens ORDER BY rowid DESC LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(limit, offset) as TokenRow[];
    return rows.map((row) => this.mapRowToToken(row));
  }

  async saveMarketData(marketData: TokenMarketData): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO market_data (
        address, priceInWeth, priceUsd, marketCapUsd, fdvUsd,
        pairedPrincipalWeth, graduationThresholdWeth, graduationProgress, isGraduated, volume24hUsd
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      marketData.address,
      marketData.priceInWeth,
      marketData.priceUsd,
      marketData.marketCapUsd,
      marketData.fdvUsd,
      marketData.pairedPrincipalWeth,
      marketData.graduationThresholdWeth,
      marketData.graduationProgress,
      marketData.isGraduated ? 1 : 0,
      marketData.volume24hUsd,
    );
  }

  async getMarketData(address: `0x${string}`): Promise<TokenMarketData | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM market_data WHERE LOWER(address) = LOWER(?) LIMIT 1
    `);
    const row = stmt.get(address) as MarketDataRow | null;
    if (!row) return null;

    return {
      address: row.address as `0x${string}`,
      priceInWeth: Number(row.priceInWeth),
      priceUsd: Number(row.priceUsd),
      marketCapUsd: Number(row.marketCapUsd),
      fdvUsd: Number(row.fdvUsd),
      pairedPrincipalWeth: row.pairedPrincipalWeth,
      graduationThresholdWeth: row.graduationThresholdWeth,
      graduationProgress: Number(row.graduationProgress),
      isGraduated: Boolean(row.isGraduated),
      volume24hUsd: Number(row.volume24hUsd),
    };
  }

  async saveTrade(trade: TradeEventEntity): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO trades (
        id, tokenAddress, poolAddress, trader, isBuy, tokenAmount,
        wethAmount, priceUsd, blockNumber, transactionHash, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      trade.id,
      trade.tokenAddress,
      trade.poolAddress,
      trade.trader,
      trade.isBuy ? 1 : 0,
      trade.tokenAmount,
      trade.wethAmount,
      trade.priceUsd,
      trade.blockNumber.toString(),
      trade.transactionHash,
      trade.timestamp,
    );
  }

  async getTrades(
    tokenAddress: `0x${string}`,
    limit = 50,
    offset = 0,
  ): Promise<TradeEventEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      WHERE LOWER(tokenAddress) = LOWER(?)
      ORDER BY timestamp DESC, rowid DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(tokenAddress, limit, offset) as TradeRow[];
    return rows.map((row) => this.mapRowToTrade(row));
  }

  async getCandlesticks(
    tokenAddress: `0x${string}`,
    resolutionSeconds = 60,
  ): Promise<CandlestickEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      WHERE LOWER(tokenAddress) = LOWER(?)
      ORDER BY timestamp ASC, rowid ASC
    `);
    const rows = stmt.all(tokenAddress) as TradeRow[];
    if (rows.length === 0) return [];

    const bucketDurationMs = resolutionSeconds * 1000;
    const buckets = new Map<number, TradeRow[]>();

    for (const row of rows) {
      const bucketTime = Math.floor(row.timestamp / bucketDurationMs) * bucketDurationMs;
      const list = buckets.get(bucketTime) ?? [];
      list.push(row);
      buckets.set(bucketTime, list);
    }

    const candles: CandlestickEntity[] = [];
    for (const [timestamp, bucketTrades] of buckets.entries()) {
      const sorted = [...bucketTrades].sort((a, b) => a.timestamp - b.timestamp);
      const prices = sorted.map((t) => Number(t.priceUsd));
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
    const token = await this.findByAddress(tokenAddress as `0x${string}`);
    let totalSupply = 1_000_000_000n * (10n ** 18n);
    if (token?.totalSupply) {
      try {
        totalSupply = BigInt(token.totalSupply);
      } catch {
        totalSupply = 1_000_000_000n * (10n ** 18n);
      }
    }

    const poolAddress = token?.poolAddress || '0x000000000000000000000000000000000000dEaD';
    const deployerAddress = token?.deployer || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    const trades = await this.getTrades(tokenAddress as `0x${string}`, 1000, 0);

    const traderBalances: Record<string, bigint> = {};
    for (const trade of trades) {
      const trader = trade.trader.toLowerCase();
      if (trader === poolAddress.toLowerCase()) continue;

      let amount = 0n;
      try {
        amount = BigInt(trade.tokenAmount);
      } catch {
        amount = BigInt(Math.floor(Number(trade.tokenAmount) || 0));
      }

      const cur = traderBalances[trader] ?? 0n;
      if (trade.isBuy) {
        traderBalances[trader] = cur + amount;
      } else {
        traderBalances[trader] = cur > amount ? cur - amount : 0n;
      }
    }

    let deployerInitial = (totalSupply * 5n) / 100n;
    if (token?.initialBuyAmount) {
      try {
        const parsed = BigInt(token.initialBuyAmount);
        if (parsed > 0n) deployerInitial = parsed;
      } catch {}
    }

    const activeTraders = Object.entries(traderBalances)
      .filter(([addr, bal]) => bal > 0n && addr !== deployerAddress.toLowerCase())
      .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0));

    const totalTraderTokens = activeTraders.reduce((sum, [, bal]) => sum + bal, 0n);
    const holders: Array<{ address: string; balance: string; percent: number }> = [];

    if (activeTraders.length === 0 || totalTraderTokens === 0n) {
      const poolBalance = (totalSupply * 90n) / 100n;
      holders.push({
        address: poolAddress,
        balance: poolBalance.toString(),
        percent: 90.0,
      });

      let deployerPercent =
        deployerInitial === (totalSupply * 5n) / 100n
          ? 5.0
          : Number((deployerInitial * 10000n) / totalSupply) / 100;
      if (deployerPercent <= 0) {
        deployerPercent = 5.0;
        deployerInitial = (totalSupply * 5n) / 100n;
      }
      holders.push({
        address: deployerAddress,
        balance: deployerInitial.toString(),
        percent: deployerPercent,
      });

      const remainingPercent = Math.max(0, 100 - 90 - deployerPercent);
      const remainingBalance = (totalSupply * BigInt(Math.round(remainingPercent * 100))) / 10000n;
      const earlyBuyerWeights = [0.5, 0.3, 0.2];
      const earlyBuyerAddresses = [
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
      ];

      for (let i = 0; i < earlyBuyerAddresses.length; i++) {
        const weight = earlyBuyerWeights[i];
        const buyerPercent = Number((remainingPercent * weight).toFixed(2));
        const buyerBal = (remainingBalance * BigInt(Math.round(weight * 1000))) / 1000n;
        holders.push({
          address: earlyBuyerAddresses[i],
          balance: buyerBal.toString(),
          percent: buyerPercent,
        });
      }
    } else {
      const deployerTradeBal = traderBalances[deployerAddress.toLowerCase()] ?? 0n;
      const totalDeployerBalance = deployerInitial + deployerTradeBal;
      const deployerPercent = Number((totalDeployerBalance * 10000n) / totalSupply) / 100;

      const nonPoolTotal = totalDeployerBalance + totalTraderTokens;
      const poolBalance =
        totalSupply > nonPoolTotal ? totalSupply - nonPoolTotal : (totalSupply * 90n) / 100n;
      const poolPercent = Number((poolBalance * 10000n) / totalSupply) / 100;

      holders.push({
        address: poolAddress,
        balance: poolBalance.toString(),
        percent: poolPercent > 0 ? poolPercent : 90.0,
      });

      holders.push({
        address: deployerAddress,
        balance: totalDeployerBalance.toString(),
        percent: deployerPercent > 0 ? deployerPercent : 5.0,
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

  close(): void {
    this.db.close();
  }

  private mapRowToToken(row: TokenRow): LaunchedTokenEntity {
    return {
      address: row.address as `0x${string}`,
      name: row.name,
      symbol: row.symbol,
      decimals: Number(row.decimals),
      totalSupply: row.totalSupply,
      logo: row.logo ?? '',
      description: row.description ?? '',
      socials: row.socials_json ? (JSON.parse(row.socials_json) as Record<string, string>) : {},
      taxConfig: row.tax_config_json
        ? (JSON.parse(row.tax_config_json) as LaunchedTokenEntity['taxConfig'])
        : undefined,
      deployer: row.deployer as `0x${string}`,
      pairedToken: row.pairedToken as `0x${string}`,
      poolAddress: row.poolAddress as `0x${string}`,
      isToken0: Boolean(row.isToken0),
      poolFee: Number(row.poolFee),
      positionId: BigInt(row.positionId),
      restrictionsEndBlock: BigInt(row.restrictionsEndBlock),
      launchBlock: BigInt(row.launchBlock),
      createdAt: Number(row.createdAt),
      initialBuyAmount: row.initialBuyAmount ?? undefined,
    };
  }

  private mapRowToTrade(row: TradeRow): TradeEventEntity {
    return {
      id: row.id,
      tokenAddress: row.tokenAddress as `0x${string}`,
      poolAddress: row.poolAddress as `0x${string}`,
      trader: row.trader as `0x${string}`,
      isBuy: Boolean(row.isBuy),
      tokenAmount: row.tokenAmount,
      wethAmount: row.wethAmount,
      priceUsd: Number(row.priceUsd),
      blockNumber: BigInt(row.blockNumber),
      transactionHash: row.transactionHash as `0x${string}`,
      timestamp: Number(row.timestamp),
    };
  }
}
