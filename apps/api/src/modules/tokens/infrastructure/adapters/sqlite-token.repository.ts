import { Database } from 'bun:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  LaunchedTokenEntity,
  TokenMarketData,
  TradeEventEntity,
  CandlestickEntity,
  TokenCommentEntity,
  getUserIdentity,
} from '@proto/shared-types';
import { TokenRepositoryPort } from '../../domain/ports/token.repository.port';
import {
  aggregateCandlesticks,
  computeHoldersDistribution,
} from '../../domain/services/token-aggregation.service';

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
  version: string | null;
  curve_address: string | null;
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
    if (resolvedPath !== ':memory:') {
      const dir = path.dirname(resolvedPath);
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      } catch (err) {
        console.warn(
          `[SqliteTokenRepository] Could not create directory ${dir}: ${(err as Error).message}`,
        );
      }
    }
    this.db = new Database(resolvedPath);
    try {
      this.db.run('PRAGMA journal_mode = WAL;');
      this.db.run('PRAGMA busy_timeout = 10000;');
    } catch {
      // Ignore if in-memory
    }
    this.initTables();
  }

  private initTables(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tokens (
        address TEXT PRIMARY KEY COLLATE NOCASE,
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
        tax_config_json TEXT,
        version TEXT,
        curve_address TEXT,
        is_graduated INTEGER DEFAULT 0,
        virtual_eth_reserve TEXT,
        virtual_token_reserve TEXT,
        graduation_target TEXT
      );
    `);

    // Safe additive migrations for existing databases
    const tokenMigrations = [
      'ALTER TABLE tokens ADD COLUMN version TEXT',
      'ALTER TABLE tokens ADD COLUMN curve_address TEXT',
      'ALTER TABLE tokens ADD COLUMN is_graduated INTEGER DEFAULT 0',
      'ALTER TABLE tokens ADD COLUMN virtual_eth_reserve TEXT',
      'ALTER TABLE tokens ADD COLUMN virtual_token_reserve TEXT',
      'ALTER TABLE tokens ADD COLUMN graduation_target TEXT',
    ];
    for (const sql of tokenMigrations) {
      try {
        this.db.run(sql);
      } catch {
        /* column already exists */
      }
    }

    // Structural migration: recreate tokens table with COLLATE NOCASE on address
    // so that checksummed and lowercase variants of the same address never produce
    // duplicate rows. Only runs when the existing table still lacks NOCASE.
    const addrColInfo = this.db
      .query<{ type: string }, []>(`PRAGMA table_info(tokens)`)
      .all()
      .find((c: Record<string, unknown>) => c['name'] === 'address');
    const hasNocase =
      typeof addrColInfo === 'object' &&
      addrColInfo !== null &&
      String((addrColInfo as Record<string, unknown>)['type'])
        .toUpperCase()
        .includes('NOCASE');
    if (!hasNocase) {
      this.db.run('BEGIN');
      try {
        this.db.run('ALTER TABLE tokens RENAME TO tokens_old');
        this.db.run(`
          CREATE TABLE tokens (
            address TEXT PRIMARY KEY COLLATE NOCASE,
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
            tax_config_json TEXT,
            version TEXT,
            curve_address TEXT,
            is_graduated INTEGER DEFAULT 0,
            virtual_eth_reserve TEXT,
            virtual_token_reserve TEXT,
            graduation_target TEXT
          )
        `);
        // Copy rows; normalise address to lowercase to remove pre-existing duplicates.
        this.db.run(`
          INSERT OR IGNORE INTO tokens
          SELECT LOWER(address), name, symbol, decimals, totalSupply, logo, description,
                 socials_json, LOWER(deployer), LOWER(pairedToken), LOWER(poolAddress),
                 isToken0, poolFee, positionId, restrictionsEndBlock, launchBlock, createdAt,
                 initialBuyAmount, tax_config_json, version,
                 CASE WHEN curve_address IS NOT NULL THEN LOWER(curve_address) ELSE NULL END,
                 is_graduated,
                 virtual_eth_reserve, virtual_token_reserve, graduation_target
          FROM tokens_old
        `);
        this.db.run('DROP TABLE tokens_old');
        this.db.run('COMMIT');
      } catch (err) {
        this.db.run('ROLLBACK');
        // Non-fatal: table may already be in correct state
        console.warn('[SqliteTokenRepository] NOCASE migration failed:', (err as Error).message);
      }
    }

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

    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_trades_tokenAddress ON trades(tokenAddress COLLATE NOCASE);`,
    );
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);`);
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_trades_txHash ON trades(transactionHash COLLATE NOCASE);`,
    );
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_trades_trader ON trades(trader COLLATE NOCASE);`);
    // Composite index covering the most common query: all trades for a token ordered by time.
    // COLLATE NOCASE on the leading column lets LOWER(tokenAddress) = LOWER(?) use the index.
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_trades_token_ts ON trades(tokenAddress COLLATE NOCASE, timestamp DESC);`,
    );
    // blockNumber index for block-range filtering in DEX event queries.
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_trades_block ON trades(blockNumber);`);
    // poolAddress index on tokens for direct pool lookup without full-table JS scan.
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_tokens_poolAddress ON tokens(poolAddress COLLATE NOCASE);`,
    );

    this.db.run(`
      CREATE TABLE IF NOT EXISTS market_data (
        address TEXT PRIMARY KEY COLLATE NOCASE,
        priceInWeth REAL NOT NULL,
        priceUsd REAL NOT NULL,
        marketCapUsd REAL NOT NULL,
        fdvUsd REAL NOT NULL,
        pairedPrincipalWeth TEXT NOT NULL,
        graduationThresholdWeth TEXT NOT NULL,
        graduationProgress REAL NOT NULL,
        isGraduated INTEGER NOT NULL,
        volume24hUsd REAL NOT NULL,
        priceChange24h REAL NOT NULL DEFAULT 0
      );
    `);

    // Safe migration: add priceChange24h column to existing databases
    try {
      this.db.run(`ALTER TABLE market_data ADD COLUMN priceChange24h REAL NOT NULL DEFAULT 0`);
    } catch {
      /* column already exists */
    }

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

    this.db.run(`
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        token_address TEXT NOT NULL,
        author_address TEXT NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        likes_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        target_mcap TEXT,
        position_usd REAL,
        call_type TEXT,
        supply_percent REAL
      );
    `);

    // Safe additive migrations for comments
    const commentMigrations = [
      'ALTER TABLE comments ADD COLUMN target_mcap TEXT',
      'ALTER TABLE comments ADD COLUMN position_usd REAL',
      'ALTER TABLE comments ADD COLUMN profit_usd REAL',
      'ALTER TABLE comments ADD COLUMN call_type TEXT',
      'ALTER TABLE comments ADD COLUMN parent_id TEXT',
      'ALTER TABLE comments ADD COLUMN quoted_callout_id TEXT',
      'ALTER TABLE comments ADD COLUMN reposts_count INTEGER DEFAULT 0',
      'ALTER TABLE comments ADD COLUMN quotes_count INTEGER DEFAULT 0',
      'ALTER TABLE comments ADD COLUMN replies_count INTEGER DEFAULT 0',
      'ALTER TABLE comments ADD COLUMN views_count INTEGER DEFAULT 0',
      'ALTER TABLE comments ADD COLUMN supply_percent REAL',
    ];
    for (const sql of commentMigrations) {
      try {
        this.db.run(sql);
      } catch {
        /* column already exists */
      }
    }

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_comments_token ON comments (token_address, created_at DESC);
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS comment_likes (
        comment_id TEXT NOT NULL,
        user_address TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (comment_id, user_address)
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS comment_reposts (
        comment_id TEXT NOT NULL,
        user_address TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (comment_id, user_address)
      );
    `);
  }

  async save(token: LaunchedTokenEntity): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tokens (
        address, name, symbol, decimals, totalSupply, logo, description,
        socials_json, deployer, pairedToken, poolAddress, isToken0, poolFee,
        positionId, restrictionsEndBlock, launchBlock, createdAt, initialBuyAmount, tax_config_json,
        version, curve_address, is_graduated, virtual_eth_reserve, virtual_token_reserve, graduation_target
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      token.address.toLowerCase(),
      token.name,
      token.symbol,
      token.decimals,
      token.totalSupply,
      token.logo ?? '',
      token.description ?? '',
      JSON.stringify(token.socials ?? {}),
      token.deployer.toLowerCase(),
      token.pairedToken.toLowerCase(),
      token.poolAddress.toLowerCase(),
      token.isToken0 ? 1 : 0,
      token.poolFee,
      token.positionId.toString(),
      token.restrictionsEndBlock.toString(),
      token.launchBlock.toString(),
      token.createdAt,
      token.initialBuyAmount ?? null,
      token.taxConfig ? JSON.stringify(token.taxConfig) : null,
      token.version ?? null,
      token.curveAddress?.toLowerCase() ?? null,
      token.isGraduated ? 1 : 0,
      token.virtualEthReserve ?? null,
      token.virtualTokenReserve ?? null,
      token.graduationTarget ?? null,
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

  async findAll(
    limit = 50,
    offset = 0,
    filters?: { version?: 'v1' | 'v2'; deployer?: string },
  ): Promise<LaunchedTokenEntity[]> {
    // Build a parameterized WHERE clause to push version/deployer filtering into SQLite.
    // Doing this in JS after a full-table fetch wastes memory and breaks LIMIT+OFFSET pagination.
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters?.version) {
      conditions.push('version = ?');
      params.push(filters.version);
    }
    if (filters?.deployer) {
      conditions.push('LOWER(deployer) = LOWER(?)');
      params.push(filters.deployer);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')} ` : '';
    const stmt = this.db.prepare(
      `SELECT * FROM tokens ${where}ORDER BY rowid DESC LIMIT ? OFFSET ?`,
    );
    const rows = stmt.all(...params, limit, offset) as TokenRow[];
    return rows.map((row) => this.mapRowToToken(row));
  }

  async saveMarketData(marketData: TokenMarketData): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO market_data (
        address, priceInWeth, priceUsd, marketCapUsd, fdvUsd,
        pairedPrincipalWeth, graduationThresholdWeth, graduationProgress, isGraduated,
        volume24hUsd, priceChange24h
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      marketData.priceChange24h ?? 0,
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
      priceChange24h: Number(
        (row as MarketDataRow & { priceChange24h?: number }).priceChange24h ?? 0,
      ),
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
    fillGaps = false,
  ): Promise<CandlestickEntity[]> {
    const token = await this.findByAddress(tokenAddress);
    const mkt = await this.getMarketData(tokenAddress);
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      WHERE LOWER(tokenAddress) = LOWER(?)
      ORDER BY timestamp ASC, rowid ASC
    `);
    const rows = stmt.all(tokenAddress) as TradeRow[];
    return aggregateCandlesticks(rows, resolutionSeconds, {
      startTime: token?.createdAt,
      endTime: Date.now(),
      fillGaps,
      maxCandles: 1000,
      fallbackPrice: mkt?.priceUsd || (token?.version === 'v2' ? 0.0000042 : 0),
    });
  }

  async getHolders(
    tokenAddress: string,
    limit = 50,
  ): Promise<Array<{ address: string; balance: string; percent: number }>> {
    const token = await this.findByAddress(tokenAddress as `0x${string}`);
    const trades = await this.getTrades(tokenAddress as `0x${string}`, 1000, 0);
    return computeHoldersDistribution(token, trades, limit);
  }

  async getRecentTrades(limit = 50): Promise<TradeEventEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      ORDER BY timestamp DESC, rowid DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as TradeRow[];
    return rows.map((row) => this.mapRowToTrade(row));
  }

  async getTradesByTrader(trader: string, limit = 50): Promise<TradeEventEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      WHERE LOWER(trader) = LOWER(?)
      ORDER BY timestamp DESC, rowid DESC
      LIMIT ?
    `);
    const rows = stmt.all(trader, limit) as TradeRow[];
    return rows.map((row) => this.mapRowToTrade(row));
  }

  async getTradesSince(sinceMs: number): Promise<TradeEventEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      WHERE timestamp >= ?
      ORDER BY timestamp ASC
    `);
    const rows = stmt.all(sinceMs) as TradeRow[];
    return rows.map((row) => this.mapRowToTrade(row));
  }

  async findTradeByHash(txHash: string): Promise<TradeEventEntity | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      WHERE LOWER(transactionHash) = LOWER(?)
      LIMIT 1
    `);
    const row = stmt.get(txHash) as TradeRow | null;
    return row ? this.mapRowToTrade(row) : null;
  }

  async findAddressByIdentity(nameOrSlug: string): Promise<string | null> {
    const q = nameOrSlug.toLowerCase().trim().replace(/^@/, '');
    if (!q) return null;
    if (/^0x[a-f0-9]{40}$/i.test(q)) return q.toLowerCase();

    // Query all distinct addresses in trades and tokens
    const stmt = this.db.prepare(`
      SELECT DISTINCT trader AS addr FROM trades WHERE trader IS NOT NULL AND trader != ''
      UNION
      SELECT DISTINCT deployer AS addr FROM tokens WHERE deployer IS NOT NULL AND deployer != ''
    `);
    const rows = stmt.all() as Array<{ addr: string }>;
    for (const r of rows) {
      if (!r.addr) continue;
      const id = getUserIdentity(r.addr);
      if (
        id.name.toLowerCase() === q ||
        id.displayName.toLowerCase() === q ||
        id.slug.toLowerCase() === q ||
        id.tag.toLowerCase() === q
      ) {
        return r.addr.toLowerCase();
      }
    }
    return null;
  }

  async getUserPositions(address: string): Promise<
    Array<{
      tokenAddress: string;
      name: string;
      symbol: string;
      logo?: string;
      balance: number;
      balanceFormatted: string;
      priceUsd: number;
      valueUsd: number;
    }>
  > {
    const trades = await this.getTradesByTrader(address, 500);
    const byToken = new Map<string, { buy: number; sell: number }>();
    for (const tr of trades) {
      const addr = tr.tokenAddress.toLowerCase();
      const cur = byToken.get(addr) || { buy: 0, sell: 0 };
      const amt = parseFloat(tr.tokenAmount || '0');
      if (tr.isBuy) cur.buy += amt;
      else cur.sell += amt;
      byToken.set(addr, cur);
    }

    const positions: Array<{
      tokenAddress: string;
      name: string;
      symbol: string;
      logo?: string;
      balance: number;
      balanceFormatted: string;
      priceUsd: number;
      valueUsd: number;
    }> = [];

    for (const [addr, stats] of byToken.entries()) {
      const net = stats.buy - stats.sell;
      if (net > 0) {
        const token = await this.findByAddress(addr as `0x${string}`);
        const md = await this.getMarketData(addr as `0x${string}`);
        const price = md?.priceUsd || 0;
        positions.push({
          tokenAddress: addr,
          name: token?.name || 'Token',
          symbol: token?.symbol || 'TOK',
          logo: token?.logo || '',
          balance: net,
          balanceFormatted: net.toLocaleString(undefined, { maximumFractionDigits: 2 }),
          priceUsd: price,
          valueUsd: net * price,
        });
      }
    }

    positions.sort((a, b) => b.valueUsd - a.valueUsd);
    return positions;
  }

  async findByPoolAddress(poolAddress: `0x${string}`): Promise<LaunchedTokenEntity | null> {
    const stmt = this.db.prepare(
      `SELECT * FROM tokens WHERE LOWER(poolAddress) = LOWER(?) LIMIT 1`,
    );
    const row = stmt.get(poolAddress) as TokenRow | null;
    return row ? this.mapRowToToken(row) : null;
  }

  async getVolumeByToken(
    sinceMs: number,
  ): Promise<Array<{ tokenAddress: string; totalWeth: number }>> {
    const stmt = this.db.prepare(`
      SELECT tokenAddress, SUM(CAST(wethAmount AS REAL)) AS totalWeth
      FROM trades
      WHERE timestamp >= ?
      GROUP BY tokenAddress
    `);
    return stmt.all(sinceMs) as Array<{ tokenAddress: string; totalWeth: number }>;
  }

  async saveComment(comment: TokenCommentEntity): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO comments (
        id, token_address, author_address, content, image_url, likes_count, created_at,
        target_mcap, position_usd, profit_usd, call_type, parent_id, quoted_callout_id,
        reposts_count, quotes_count, replies_count
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      comment.id,
      comment.tokenAddress.toLowerCase(),
      comment.authorAddress.toLowerCase(),
      comment.content,
      comment.imageUrl ?? null,
      comment.likesCount || 0,
      comment.createdAt,
      comment.targetMcap ?? null,
      comment.positionUsd ?? null,
      comment.profitUsd ?? null,
      comment.callType ?? 'call',
      comment.parentId ?? null,
      comment.quotedCalloutId ?? null,
      comment.repostsCount || 0,
      comment.quotesCount || 0,
      comment.repliesCount || 0,
    );

    if (comment.parentId) {
      try {
        this.db
          .prepare(`UPDATE comments SET replies_count = replies_count + 1 WHERE id = ?`)
          .run(comment.parentId);
      } catch {
        /* ignore missing parent */
      }
    }
    if (comment.quotedCalloutId) {
      try {
        this.db
          .prepare(`UPDATE comments SET quotes_count = quotes_count + 1 WHERE id = ?`)
          .run(comment.quotedCalloutId);
      } catch {
        /* ignore missing quoted callout */
      }
    }
  }

  async getComments(tokenAddress: string, viewerAddress?: string): Promise<TokenCommentEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM comments
      WHERE LOWER(token_address) = LOWER(?) AND (parent_id IS NULL OR parent_id = '')
      ORDER BY created_at DESC
      LIMIT 100
    `);
    interface CommentRow {
      id: string;
      token_address: string;
      author_address: string;
      content: string;
      image_url: string | null;
      likes_count: number;
      created_at: number;
      target_mcap: string | null;
      position_usd: number | null;
      profit_usd: number | null;
      call_type: string | null;
      parent_id: string | null;
      quoted_callout_id: string | null;
      reposts_count: number | null;
      quotes_count: number | null;
      replies_count: number | null;
      views_count: number | null;
      supply_percent: number | null;
    }
    const rows = stmt.all(tokenAddress) as CommentRow[];

    let viewerLikedIds = new Set<string>();
    let viewerRepostedIds = new Set<string>();
    if (viewerAddress) {
      const likeStmt = this.db.prepare(`
        SELECT comment_id FROM comment_likes
        WHERE LOWER(user_address) = LOWER(?)
      `);
      const likeRows = likeStmt.all(viewerAddress) as Array<{ comment_id: string }>;
      viewerLikedIds = new Set(likeRows.map((r) => r.comment_id));

      const repostStmt = this.db.prepare(`
        SELECT comment_id FROM comment_reposts
        WHERE LOWER(user_address) = LOWER(?)
      `);
      const repostRows = repostStmt.all(viewerAddress) as Array<{ comment_id: string }>;
      viewerRepostedIds = new Set(repostRows.map((r) => r.comment_id));
    }

    return rows.map((r) => ({
      id: r.id,
      tokenAddress: r.token_address,
      authorAddress: r.author_address,
      content: r.content,
      imageUrl: r.image_url ?? undefined,
      likesCount: Number(r.likes_count || 0),
      createdAt: Number(r.created_at),
      isLikedByViewer: viewerLikedIds.has(r.id),
      isRepostedByViewer: viewerRepostedIds.has(r.id),
      targetMcap: r.target_mcap ?? undefined,
      positionUsd: r.position_usd != null ? Number(r.position_usd) : undefined,
      supplyPercent: r.supply_percent != null ? Number(r.supply_percent) : undefined,
      profitUsd: r.profit_usd != null ? Number(r.profit_usd) : undefined,
      callType: (r.call_type as 'call' | 'comment') ?? 'call',
      parentId: r.parent_id ?? undefined,
      quotedCalloutId: r.quoted_callout_id ?? undefined,
      repostsCount: Number(r.reposts_count || 0),
      quotesCount: Number(r.quotes_count || 0),
      repliesCount: Number(r.replies_count || 0),
      viewsCount: Number(r.views_count || 0),
    }));
  }

  async getFeedCallouts(
    limit = 50,
    offset = 0,
    viewerAddress?: string,
    authorAddress?: string,
  ): Promise<import('@proto/shared-types').FeedCalloutItem[]> {
    let sql = `
      SELECT 
        c.id, c.token_address, c.author_address, c.content, c.image_url, 
        c.likes_count, c.created_at, c.target_mcap, c.position_usd, c.profit_usd, c.call_type,
        c.parent_id, c.quoted_callout_id, c.reposts_count, c.quotes_count, c.replies_count, c.views_count, c.supply_percent,
        t.name as token_name, t.symbol as token_symbol, t.logo as token_logo,
        m.marketCapUsd as token_market_cap, m.priceUsd as token_price_usd
      FROM comments c
      LEFT JOIN tokens t ON LOWER(t.address) = LOWER(c.token_address)
      LEFT JOIN market_data m ON LOWER(m.address) = LOWER(c.token_address)
      WHERE (c.parent_id IS NULL OR c.parent_id = '')
    `;
    const params: (string | number)[] = [];
    if (authorAddress) {
      sql += ` AND LOWER(c.author_address) = LOWER(?)`;
      params.push(authorAddress);
    }
    sql += ` ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(sql);
    interface FeedRow {
      id: string;
      token_address: string;
      author_address: string;
      content: string;
      image_url: string | null;
      likes_count: number;
      created_at: number;
      target_mcap: string | null;
      position_usd: number | null;
      profit_usd: number | null;
      call_type: string | null;
      parent_id: string | null;
      quoted_callout_id: string | null;
      reposts_count: number | null;
      quotes_count: number | null;
      replies_count: number | null;
      views_count: number | null;
      supply_percent: number | null;
      token_name: string | null;
      token_symbol: string | null;
      token_logo: string | null;
      token_market_cap: number | null;
      token_price_usd: number | null;
    }

    const rows = stmt.all(...params) as FeedRow[];

    let viewerLikedIds = new Set<string>();
    let viewerRepostedIds = new Set<string>();
    if (viewerAddress) {
      const likeStmt = this.db.prepare(`
        SELECT comment_id FROM comment_likes
        WHERE LOWER(user_address) = LOWER(?)
      `);
      const likeRows = likeStmt.all(viewerAddress) as Array<{ comment_id: string }>;
      viewerLikedIds = new Set(likeRows.map((r) => r.comment_id));

      const repostStmt = this.db.prepare(`
        SELECT comment_id FROM comment_reposts
        WHERE LOWER(user_address) = LOWER(?)
      `);
      const repostRows = repostStmt.all(viewerAddress) as Array<{ comment_id: string }>;
      viewerRepostedIds = new Set(repostRows.map((r) => r.comment_id));
    }

    const feedItems: import('@proto/shared-types').FeedCalloutItem[] = rows.map((r) => ({
      id: r.id,
      tokenAddress: r.token_address,
      authorAddress: r.author_address,
      content: r.content,
      imageUrl: r.image_url ?? undefined,
      likesCount: Number(r.likes_count || 0),
      createdAt: Number(r.created_at),
      isLikedByViewer: viewerLikedIds.has(r.id),
      isRepostedByViewer: viewerRepostedIds.has(r.id),
      targetMcap: r.target_mcap ?? undefined,
      positionUsd: r.position_usd != null ? Number(r.position_usd) : undefined,
      supplyPercent: r.supply_percent != null ? Number(r.supply_percent) : undefined,
      profitUsd: r.profit_usd != null ? Number(r.profit_usd) : undefined,
      callType: (r.call_type as 'call' | 'comment') ?? 'call',
      parentId: r.parent_id ?? undefined,
      quotedCalloutId: r.quoted_callout_id ?? undefined,
      repostsCount: Number(r.reposts_count || 0),
      quotesCount: Number(r.quotes_count || 0),
      repliesCount: Number(r.replies_count || 0),
      viewsCount: Number(r.views_count || 0),
      tokenName: r.token_name ?? undefined,
      tokenSymbol: r.token_symbol ?? undefined,
      tokenLogo: r.token_logo ?? undefined,
      tokenMarketCapUsd: r.token_market_cap != null ? Number(r.token_market_cap) : undefined,
      tokenPriceUsd: r.token_price_usd != null ? Number(r.token_price_usd) : undefined,
    }));

    // Populate quotes if any exist
    for (const item of feedItems) {
      if (item.quotedCalloutId) {
        const quoted = this.getSingleCallout(item.quotedCalloutId);
        if (quoted) item.quotedCallout = quoted;
      }
    }

    return feedItems;
  }

  private getSingleCallout(
    calloutId: string,
  ): import('@proto/shared-types').FeedCalloutItem | null {
    const stmt = this.db.prepare(`
      SELECT 
        c.id, c.token_address, c.author_address, c.content, c.image_url, 
        c.likes_count, c.created_at, c.target_mcap, c.position_usd, c.profit_usd, c.call_type,
        c.parent_id, c.quoted_callout_id, c.reposts_count, c.quotes_count, c.replies_count, c.views_count, c.supply_percent,
        t.name as token_name, t.symbol as token_symbol, t.logo as token_logo,
        m.marketCapUsd as token_market_cap, m.priceUsd as token_price_usd
      FROM comments c
      LEFT JOIN tokens t ON LOWER(t.address) = LOWER(c.token_address)
      LEFT JOIN market_data m ON LOWER(m.address) = LOWER(c.token_address)
      WHERE c.id = ?
      LIMIT 1
    `);
    interface FeedCalloutRow {
      id: string;
      token_address: string;
      author_address: string;
      content: string;
      image_url: string | null;
      likes_count: number | null;
      created_at: number;
      target_mcap: string | null;
      position_usd: number | null;
      supply_percent: number | null;
      profit_usd: number | null;
      call_type: string | null;
      parent_id: string | null;
      quoted_callout_id: string | null;
      reposts_count: number | null;
      quotes_count: number | null;
      replies_count: number | null;
      views_count?: number | null;
      token_name: string | null;
      token_symbol: string | null;
      token_logo: string | null;
      token_market_cap: number | null;
      token_price_usd: number | null;
    }

    const r = stmt.get(calloutId) as FeedCalloutRow | null;
    if (!r) return null;

    return {
      id: r.id,
      tokenAddress: r.token_address,
      authorAddress: r.author_address,
      content: r.content,
      imageUrl: r.image_url ?? undefined,
      likesCount: Number(r.likes_count || 0),
      createdAt: Number(r.created_at),
      targetMcap: r.target_mcap ?? undefined,
      positionUsd: r.position_usd != null ? Number(r.position_usd) : undefined,
      supplyPercent: r.supply_percent != null ? Number(r.supply_percent) : undefined,
      profitUsd: r.profit_usd != null ? Number(r.profit_usd) : undefined,
      callType: (r.call_type as 'call' | 'comment') ?? 'call',
      parentId: r.parent_id ?? undefined,
      quotedCalloutId: r.quoted_callout_id ?? undefined,
      repostsCount: Number(r.reposts_count || 0),
      quotesCount: Number(r.quotes_count || 0),
      repliesCount: Number(r.replies_count || 0),
      viewsCount: Number(r.views_count || 0),
      tokenName: r.token_name ?? undefined,
      tokenSymbol: r.token_symbol ?? undefined,
      tokenLogo: r.token_logo ?? undefined,
      tokenMarketCapUsd: r.token_market_cap != null ? Number(r.token_market_cap) : undefined,
      tokenPriceUsd: r.token_price_usd != null ? Number(r.token_price_usd) : undefined,
    };
  }

  async incrementCommentViews(commentId: string): Promise<number> {
    try {
      this.db
        .prepare(`UPDATE comments SET views_count = views_count + 1 WHERE id = ?`)
        .run(commentId);
      const row = this.db
        .prepare(`SELECT views_count FROM comments WHERE id = ?`)
        .get(commentId) as { views_count: number } | null;
      return row ? Number(row.views_count) : 1;
    } catch {
      return 1;
    }
  }

  async getCalloutThread(
    calloutId: string,
    viewerAddress?: string,
  ): Promise<import('@proto/shared-types').FeedCalloutItem | null> {
    // Automatically increment views on thread detail fetch
    try {
      this.db
        .prepare(`UPDATE comments SET views_count = views_count + 1 WHERE id = ?`)
        .run(calloutId);
    } catch {
      /* view count increment error is non-fatal */
    }

    const root = this.getSingleCallout(calloutId);
    if (!root) return null;

    let viewerLikedIds = new Set<string>();
    let viewerRepostedIds = new Set<string>();
    if (viewerAddress) {
      const likeStmt = this.db.prepare(`
        SELECT comment_id FROM comment_likes
        WHERE LOWER(user_address) = LOWER(?)
      `);
      const likeRows = likeStmt.all(viewerAddress) as Array<{ comment_id: string }>;
      viewerLikedIds = new Set(likeRows.map((r) => r.comment_id));

      const repostStmt = this.db.prepare(`
        SELECT comment_id FROM comment_reposts
        WHERE LOWER(user_address) = LOWER(?)
      `);
      const repostRows = repostStmt.all(viewerAddress) as Array<{ comment_id: string }>;
      viewerRepostedIds = new Set(repostRows.map((r) => r.comment_id));
    }

    root.isLikedByViewer = viewerLikedIds.has(root.id);
    root.isRepostedByViewer = viewerRepostedIds.has(root.id);
    if (root.quotedCalloutId) {
      const quoted = this.getSingleCallout(root.quotedCalloutId);
      if (quoted) root.quotedCallout = quoted;
    }

    // Fetch replies in chronological order
    const replyStmt = this.db.prepare(`
      SELECT 
        c.id, c.token_address, c.author_address, c.content, c.image_url, 
        c.likes_count, c.created_at, c.target_mcap, c.position_usd, c.profit_usd, c.call_type,
        c.parent_id, c.quoted_callout_id, c.reposts_count, c.quotes_count, c.replies_count, c.supply_percent,
        t.name as token_name, t.symbol as token_symbol, t.logo as token_logo,
        m.marketCapUsd as token_market_cap, m.priceUsd as token_price_usd
      FROM comments c
      LEFT JOIN tokens t ON LOWER(t.address) = LOWER(c.token_address)
      LEFT JOIN market_data m ON LOWER(m.address) = LOWER(c.token_address)
      WHERE c.parent_id = ?
      ORDER BY c.created_at ASC
      LIMIT 100
    `);

    const replyRows = replyStmt.all(calloutId) as Array<{
      id: string;
      token_address: string;
      author_address: string;
      content: string;
      image_url: string | null;
      likes_count: number | null;
      created_at: number;
      target_mcap: string | null;
      position_usd: number | null;
      supply_percent: number | null;
      profit_usd: number | null;
      call_type: string | null;
      parent_id: string | null;
      quoted_callout_id: string | null;
      reposts_count: number | null;
      quotes_count: number | null;
      replies_count: number | null;
      token_name: string | null;
      token_symbol: string | null;
      token_logo: string | null;
      token_market_cap: number | null;
      token_price_usd: number | null;
    }>;
    root.replies = replyRows.map((r) => ({
      id: r.id,
      tokenAddress: r.token_address,
      authorAddress: r.author_address,
      content: r.content,
      imageUrl: r.image_url ?? undefined,
      likesCount: Number(r.likes_count || 0),
      createdAt: Number(r.created_at),
      isLikedByViewer: viewerLikedIds.has(r.id),
      isRepostedByViewer: viewerRepostedIds.has(r.id),
      targetMcap: r.target_mcap ?? undefined,
      positionUsd: r.position_usd != null ? Number(r.position_usd) : undefined,
      supplyPercent: r.supply_percent != null ? Number(r.supply_percent) : undefined,
      profitUsd: r.profit_usd != null ? Number(r.profit_usd) : undefined,
      callType: (r.call_type as 'call' | 'comment') ?? 'comment',
      parentId: r.parent_id ?? undefined,
      quotedCalloutId: r.quoted_callout_id ?? undefined,
      repostsCount: Number(r.reposts_count || 0),
      quotesCount: Number(r.quotes_count || 0),
      repliesCount: Number(r.replies_count || 0),
      tokenName: r.token_name ?? undefined,
      tokenSymbol: r.token_symbol ?? undefined,
      tokenLogo: r.token_logo ?? undefined,
      tokenMarketCapUsd: r.token_market_cap != null ? Number(r.token_market_cap) : undefined,
      tokenPriceUsd: r.token_price_usd != null ? Number(r.token_price_usd) : undefined,
    }));

    return root;
  }

  private runInTransaction<T>(fn: () => T): T {
    const bunDb = this.db as unknown as { transaction?: (fn: () => T) => () => T };
    if (typeof bunDb.transaction === 'function') {
      return bunDb.transaction(fn)();
    }
    this.db.run('BEGIN');
    try {
      const res = fn();
      this.db.run('COMMIT');
      return res;
    } catch (e) {
      try {
        this.db.run('ROLLBACK');
      } catch {
        /* rollback is best-effort */
      }
      throw e;
    }
  }

  async toggleCommentRepost(
    commentId: string,
    userAddress: string,
  ): Promise<{ reposted: boolean; repostsCount: number }> {
    return this.runInTransaction(() => {
      const checkStmt = this.db.prepare(`
        SELECT 1 FROM comment_reposts
        WHERE comment_id = ? AND LOWER(user_address) = LOWER(?)
        LIMIT 1
      `);
      const existing = checkStmt.get(commentId, userAddress);

      if (existing) {
        this.db
          .prepare(
            `DELETE FROM comment_reposts WHERE comment_id = ? AND LOWER(user_address) = LOWER(?)`,
          )
          .run(commentId, userAddress);
        this.db
          .prepare(`UPDATE comments SET reposts_count = MAX(0, reposts_count - 1) WHERE id = ?`)
          .run(commentId);
        const countRow = this.db
          .prepare(`SELECT reposts_count FROM comments WHERE id = ?`)
          .get(commentId) as { reposts_count: number } | null;
        return { reposted: false, repostsCount: countRow ? Number(countRow.reposts_count) : 0 };
      } else {
        this.db
          .prepare(
            `INSERT OR REPLACE INTO comment_reposts (comment_id, user_address, created_at) VALUES (?, ?, ?)`,
          )
          .run(commentId, userAddress.toLowerCase(), Date.now());
        this.db
          .prepare(`UPDATE comments SET reposts_count = reposts_count + 1 WHERE id = ?`)
          .run(commentId);
        const countRow = this.db
          .prepare(`SELECT reposts_count FROM comments WHERE id = ?`)
          .get(commentId) as { reposts_count: number } | null;
        return { reposted: true, repostsCount: countRow ? Number(countRow.reposts_count) : 1 };
      }
    });
  }

  async toggleCommentLike(
    commentId: string,
    userAddress: string,
  ): Promise<{ liked: boolean; likesCount: number }> {
    // Wrap in an immediate transaction to eliminate the TOCTOU race between the
    // SELECT-check and the DELETE/INSERT+UPDATE pair. Without this, two concurrent
    // requests from the same user can both pass the check and double-insert the like.
    return this.runInTransaction(() => {
      const checkStmt = this.db.prepare(`
        SELECT 1 FROM comment_likes
        WHERE comment_id = ? AND LOWER(user_address) = LOWER(?)
        LIMIT 1
      `);
      const existing = checkStmt.get(commentId, userAddress);

      if (existing) {
        this.db
          .prepare(
            `DELETE FROM comment_likes WHERE comment_id = ? AND LOWER(user_address) = LOWER(?)`,
          )
          .run(commentId, userAddress);
        this.db
          .prepare(`UPDATE comments SET likes_count = MAX(0, likes_count - 1) WHERE id = ?`)
          .run(commentId);
        const countRow = this.db
          .prepare(`SELECT likes_count FROM comments WHERE id = ?`)
          .get(commentId) as { likes_count: number } | null;
        return { liked: false, likesCount: countRow ? Number(countRow.likes_count) : 0 };
      } else {
        this.db
          .prepare(
            `INSERT OR REPLACE INTO comment_likes (comment_id, user_address, created_at) VALUES (?, ?, ?)`,
          )
          .run(commentId, userAddress.toLowerCase(), Date.now());
        this.db
          .prepare(`UPDATE comments SET likes_count = likes_count + 1 WHERE id = ?`)
          .run(commentId);
        const countRow = this.db
          .prepare(`SELECT likes_count FROM comments WHERE id = ?`)
          .get(commentId) as { likes_count: number } | null;
        return { liked: true, likesCount: countRow ? Number(countRow.likes_count) : 1 };
      }
    });
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
      version: (row.version as 'v1' | 'v2' | null) ?? undefined,
      curveAddress: (row.curve_address as `0x${string}` | null) ?? undefined,
      isGraduated: Boolean((row as TokenRow & { is_graduated?: number }).is_graduated),
      virtualEthReserve:
        (row as TokenRow & { virtual_eth_reserve?: string | null }).virtual_eth_reserve ??
        undefined,
      virtualTokenReserve:
        (row as TokenRow & { virtual_token_reserve?: string | null }).virtual_token_reserve ??
        undefined,
      graduationTarget:
        (row as TokenRow & { graduation_target?: string | null }).graduation_target ?? undefined,
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
