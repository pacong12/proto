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
  TokenVotesSummary,
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
        created_at INTEGER NOT NULL
      );
    `);

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
      CREATE TABLE IF NOT EXISTS token_votes (
        token_address TEXT NOT NULL,
        user_address TEXT NOT NULL,
        vote_type TEXT NOT NULL CHECK (vote_type IN ('bullish', 'bearish')),
        created_at INTEGER NOT NULL,
        PRIMARY KEY (token_address, user_address)
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

  async findTradeByHash(txHash: string): Promise<TradeEventEntity | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      WHERE LOWER(transactionHash) = LOWER(?)
      LIMIT 1
    `);
    const row = stmt.get(txHash) as TradeRow | null;
    return row ? this.mapRowToTrade(row) : null;
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
      INSERT INTO comments (id, token_address, author_address, content, image_url, likes_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      comment.id,
      comment.tokenAddress.toLowerCase(),
      comment.authorAddress.toLowerCase(),
      comment.content,
      comment.imageUrl ?? null,
      comment.likesCount || 0,
      comment.createdAt,
    );
  }

  async getComments(tokenAddress: string, viewerAddress?: string): Promise<TokenCommentEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM comments
      WHERE LOWER(token_address) = LOWER(?)
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
    }
    const rows = stmt.all(tokenAddress) as CommentRow[];

    let viewerLikedIds = new Set<string>();
    if (viewerAddress) {
      const likeStmt = this.db.prepare(`
        SELECT comment_id FROM comment_likes
        WHERE LOWER(user_address) = LOWER(?)
      `);
      const likeRows = likeStmt.all(viewerAddress) as Array<{ comment_id: string }>;
      viewerLikedIds = new Set(likeRows.map((r) => r.comment_id));
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
    }));
  }

  async toggleCommentLike(
    commentId: string,
    userAddress: string,
  ): Promise<{ liked: boolean; likesCount: number }> {
    // Wrap in an immediate transaction to eliminate the TOCTOU race between the
    // SELECT-check and the DELETE/INSERT+UPDATE pair. Without this, two concurrent
    // requests from the same user can both pass the check and double-insert the like.
    return this.db.transaction(() => {
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
    })() as { liked: boolean; likesCount: number };
  }

  async saveVote(
    tokenAddress: string,
    userAddress: string,
    voteType: 'bullish' | 'bearish',
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO token_votes (token_address, user_address, vote_type, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(tokenAddress.toLowerCase(), userAddress.toLowerCase(), voteType, Date.now());
  }

  async getVotes(tokenAddress: string, viewerAddress?: string): Promise<TokenVotesSummary> {
    const countStmt = this.db.prepare(`
      SELECT
        SUM(CASE WHEN vote_type = 'bullish' THEN 1 ELSE 0 END) as bullish,
        SUM(CASE WHEN vote_type = 'bearish' THEN 1 ELSE 0 END) as bearish,
        COUNT(*) as total
      FROM token_votes
      WHERE LOWER(token_address) = LOWER(?)
    `);
    const counts = countStmt.get(tokenAddress) as {
      bullish: number | null;
      bearish: number | null;
      total: number | null;
    } | null;
    const bullishCount = Number(counts?.bullish || 0);
    const bearishCount = Number(counts?.bearish || 0);
    const totalVotes = Number(counts?.total || 0);
    const bullishPercent = totalVotes > 0 ? Math.round((bullishCount / totalVotes) * 100) : 50;

    let viewerVote: 'bullish' | 'bearish' | undefined;
    if (viewerAddress) {
      const viewerStmt = this.db.prepare(`
        SELECT vote_type FROM token_votes
        WHERE LOWER(token_address) = LOWER(?) AND LOWER(user_address) = LOWER(?)
        LIMIT 1
      `);
      const row = viewerStmt.get(tokenAddress, viewerAddress) as {
        vote_type: 'bullish' | 'bearish';
      } | null;
      if (row) viewerVote = row.vote_type;
    }

    return {
      tokenAddress,
      bullishCount,
      bearishCount,
      totalVotes,
      bullishPercent,
      viewerVote,
    };
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
