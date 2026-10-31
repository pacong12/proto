import { Database } from 'bun:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { LaunchedTokenEntity, TradeEventEntity } from '@goton/shared-types';
import { backupDatabase, openCheckedDatabase } from './sqlite-maintenance';
import { TokenRow, TradeRow, defaultDbPath } from './sqlite-rows';

/** The SQLite connection, schema and row mapping every store shares. */
export class SqliteDatabase {
  protected db: Database;

  protected readonly dbPath: string;

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
    this.dbPath = resolvedPath;
    this.db = openCheckedDatabase(resolvedPath);
    try {
      this.db.run('PRAGMA journal_mode = WAL;');
      this.db.run('PRAGMA synchronous = NORMAL;');
      this.db.run('PRAGMA busy_timeout = 10000;');
      this.db.run('PRAGMA cache_size = -16000;');
      this.db.run('PRAGMA temp_store = MEMORY;');
      this.db.run('PRAGMA mmap_size = 67108864;');
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
        timestamp INTEGER NOT NULL,
        priceQuote REAL
      );
    `);
    // Trades indexed before the spot price in the quote asset was recorded keep NULL.
    try {
      this.db.run(`ALTER TABLE trades ADD COLUMN priceQuote REAL`);
    } catch {
      /* column already exists */
    }

    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_trades_tokenAddress ON trades(tokenAddress COLLATE NOCASE);`,
    );
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);`);
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_trades_txHash ON trades(transactionHash COLLATE NOCASE);`,
    );
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_trades_trader ON trades(trader COLLATE NOCASE);`);
    // Composite index covering the most common query: all trades for a token ordered by time.
    // Query it as `tokenAddress = ? COLLATE NOCASE`: LOWER(tokenAddress) = LOWER(?) cannot use it
    // and scans every trade.
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
        priceChange24h REAL NOT NULL DEFAULT 0,
        updatedAt INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Safe migration: add priceChange24h column to existing databases
    try {
      this.db.run(`ALTER TABLE market_data ADD COLUMN priceChange24h REAL NOT NULL DEFAULT 0`);
    } catch {
      /* column already exists */
    }
    // Existing rows get 0, so they count as stale and are recomputed first.
    try {
      this.db.run(`ALTER TABLE market_data ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0`);
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
      'ALTER TABLE comments ADD COLUMN price_at_post REAL',
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
      CREATE TABLE IF NOT EXISTS follows (
        follower TEXT NOT NULL,
        followee TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (follower, followee)
      );
    `);
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows (followee, created_at DESC);`,
    );

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

    this.db.run(`
      CREATE TABLE IF NOT EXISTS indexer_cursor (
        network TEXT PRIMARY KEY,
        last_block TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // On-chain token balances, refreshed with balanceOf for every holder a Transfer touches.
    // holder_index marks tokens whose whole Transfer history has been read since launch.
    this.db.run(`
      CREATE TABLE IF NOT EXISTS token_balances (
        token_address TEXT NOT NULL COLLATE NOCASE,
        holder TEXT NOT NULL COLLATE NOCASE,
        balance TEXT NOT NULL,
        PRIMARY KEY (token_address, holder)
      );
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS holder_index (
        token_address TEXT PRIMARY KEY COLLATE NOCASE,
        indexed_at INTEGER NOT NULL
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS token_sentiment (
        token_address TEXT NOT NULL COLLATE NOCASE,
        user_address TEXT NOT NULL COLLATE NOCASE,
        sentiment TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (token_address, user_address)
      );
    `);
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_sentiment_token ON token_sentiment(token_address COLLATE NOCASE);`,
    );

    this.db.run(`
      CREATE TABLE IF NOT EXISTS buyback_burns (
        id TEXT PRIMARY KEY,
        token_address TEXT NOT NULL COLLATE NOCASE,
        network TEXT NOT NULL,
        weth_spent TEXT NOT NULL,
        tokens_burned TEXT NOT NULL,
        transaction_hash TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_buyback_token ON buyback_burns(token_address COLLATE NOCASE);`,
    );
    this.db.run(`
      CREATE TABLE IF NOT EXISTS limit_orders (
        key TEXT PRIMARY KEY,
        chain_id INTEGER NOT NULL,
        order_id TEXT NOT NULL,
        owner TEXT NOT NULL COLLATE NOCASE,
        token TEXT NOT NULL COLLATE NOCASE,
        is_buy INTEGER NOT NULL,
        amount TEXT NOT NULL,
        min_out TEXT NOT NULL,
        sl_price_x36 TEXT NOT NULL,
        sl_min_out TEXT NOT NULL,
        deadline INTEGER NOT NULL,
        status TEXT NOT NULL,
        filled_leg TEXT,
        amount_out TEXT,
        created_tx TEXT NOT NULL,
        closed_tx TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    try {
      // The GotonLimitOrders deployment holding the order; NULL on rows indexed before it was kept.
      this.db.run('ALTER TABLE limit_orders ADD COLUMN contract TEXT');
    } catch {
      // Column already exists
    }
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_limit_orders_owner ON limit_orders(owner, status);`,
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_limit_orders_token ON limit_orders(token, status);`,
    );
    this.db.run(`
      CREATE TABLE IF NOT EXISTS profiles (
        address TEXT PRIMARY KEY COLLATE NOCASE,
        profile_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  protected runInTransaction<T>(fn: () => T): T {
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

  /** DR-04: hot snapshot into `<db dir>/backups`, keeping the newest `keep` files. */
  backup(keep?: number): string | null {
    if (this.dbPath === ':memory:') return null;
    return backupDatabase(this.db, this.dbPath, keep);
  }

  close(): void {
    this.db.close();
  }

  protected mapRowToToken(row: TokenRow): LaunchedTokenEntity {
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

  protected mapRowToTrade(row: TradeRow): TradeEventEntity {
    return {
      id: row.id,
      tokenAddress: row.tokenAddress as `0x${string}`,
      poolAddress: row.poolAddress as `0x${string}`,
      trader: row.trader as `0x${string}`,
      isBuy: Boolean(row.isBuy),
      tokenAmount: row.tokenAmount,
      wethAmount: row.wethAmount,
      priceUsd: Number(row.priceUsd),
      ...(row.priceQuote ? { priceQuote: Number(row.priceQuote) } : {}),
      blockNumber: BigInt(row.blockNumber),
      transactionHash: row.transactionHash as `0x${string}`,
      timestamp: Number(row.timestamp),
    };
  }
}
