import type { TokenStorePort } from '../../domain/ports/token-store.port';
import { LaunchedTokenEntity, TokenMarketData } from '@goton/shared-types';
import { TokenRow, MarketDataRow } from './sqlite-rows';

import { SqliteDatabase } from './sqlite-database';

/** Tokens, market data, holders, sentiment, buybacks and the indexer cursor. */
export class SqliteTokenStore extends SqliteDatabase implements TokenStorePort {
  async save(token: LaunchedTokenEntity): Promise<void> {
    let finalTaxConfig = token.taxConfig;
    try {
      const existingRow = this.db
        .prepare('SELECT tax_config_json FROM tokens WHERE LOWER(address) = LOWER(?) LIMIT 1')
        .get(token.address) as { tax_config_json?: string | null } | undefined;
      if (existingRow?.tax_config_json) {
        const parsed = JSON.parse(existingRow.tax_config_json) as LaunchedTokenEntity['taxConfig'];
        if (parsed?.revenueSplit && !finalTaxConfig?.revenueSplit) {
          finalTaxConfig = {
            buyTaxBps: finalTaxConfig?.buyTaxBps ?? parsed.buyTaxBps ?? 0,
            sellTaxBps: finalTaxConfig?.sellTaxBps ?? parsed.sellTaxBps ?? 0,
            taxRecipient: finalTaxConfig?.taxRecipient ?? parsed.taxRecipient ?? token.deployer,
            revenueSplit: parsed.revenueSplit,
          };
        }
      }
    } catch {
      // ignore parse errors
    }

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
      finalTaxConfig ? JSON.stringify(finalTaxConfig) : null,
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
        volume24hUsd, priceChange24h, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      Date.now(),
    );
  }

  async findStaleMarketData(olderThanMs: number, limit: number): Promise<`0x${string}`[]> {
    const rows = this.db
      .prepare(
        `SELECT t.address AS address FROM tokens t
         LEFT JOIN market_data m ON LOWER(m.address) = LOWER(t.address)
         WHERE m.address IS NULL OR m.updatedAt < ?
         ORDER BY COALESCE(m.updatedAt, 0) ASC
         LIMIT ?`,
      )
      .all(olderThanMs, limit) as Array<{ address: string }>;
    return rows.map((r) => r.address as `0x${string}`);
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

  async saveBalances(
    tokenAddress: `0x${string}`,
    balances: Array<{ holder: `0x${string}`; balance: bigint }>,
  ): Promise<void> {
    const upsert = this.db.prepare(
      `INSERT INTO token_balances (token_address, holder, balance) VALUES (?, ?, ?)
       ON CONFLICT(token_address, holder) DO UPDATE SET balance = excluded.balance`,
    );
    const remove = this.db.prepare(
      `DELETE FROM token_balances WHERE token_address = ? COLLATE NOCASE AND holder = ? COLLATE NOCASE`,
    );
    this.db.run('BEGIN');
    try {
      for (const b of balances) {
        if (b.balance > 0n)
          upsert.run(tokenAddress.toLowerCase(), b.holder.toLowerCase(), b.balance.toString());
        else remove.run(tokenAddress, b.holder);
      }
      this.db.run('COMMIT');
    } catch (err) {
      this.db.run('ROLLBACK');
      throw err;
    }
  }

  async markHoldersIndexed(tokenAddress: `0x${string}`): Promise<void> {
    this.db
      .prepare(`INSERT OR REPLACE INTO holder_index (token_address, indexed_at) VALUES (?, ?)`)
      .run(tokenAddress.toLowerCase(), Date.now());
  }

  async getHolderIndexedTokens(): Promise<Set<string>> {
    const rows = this.db.prepare(`SELECT token_address FROM holder_index`).all() as Array<{
      token_address: string;
    }>;
    return new Set(rows.map((r) => r.token_address.toLowerCase()));
  }

  async findByPoolAddress(poolAddress: `0x${string}`): Promise<LaunchedTokenEntity | null> {
    const stmt = this.db.prepare(
      `SELECT * FROM tokens WHERE LOWER(poolAddress) = LOWER(?) LIMIT 1`,
    );
    const row = stmt.get(poolAddress) as TokenRow | null;
    return row ? this.mapRowToToken(row) : null;
  }

  async getLastIndexedBlock(networkName: string): Promise<bigint | null> {
    try {
      const row = this.db
        .prepare('SELECT last_block FROM indexer_cursor WHERE network = ? LIMIT 1')
        .get(networkName) as { last_block?: string } | undefined;
      if (!row || !row.last_block) return null;
      return BigInt(row.last_block);
    } catch {
      return null;
    }
  }

  async setLastIndexedBlock(networkName: string, blockNumber: bigint): Promise<void> {
    try {
      this.db
        .prepare(
          `INSERT INTO indexer_cursor (network, last_block, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(network) DO UPDATE SET
             last_block = excluded.last_block,
             updated_at = excluded.updated_at`,
        )
        .run(networkName, blockNumber.toString(), Date.now());
    } catch (err) {
      console.warn(
        `[SqliteTokenRepository] Could not persist indexer block: ${(err as Error).message}`,
      );
    }
  }

  async getTokenSentiment(
    tokenAddress: string,
    userAddress?: string,
  ): Promise<{
    bullVotes: number;
    bearVotes: number;
    totalVotes: number;
    bullPercent: number;
    bearPercent: number;
    userVote?: 'bull' | 'bear';
  }> {
    try {
      const rows = this.db
        .prepare(
          `SELECT sentiment, COUNT(*) as count FROM token_sentiment WHERE LOWER(token_address) = LOWER(?) GROUP BY sentiment`,
        )
        .all(tokenAddress) as Array<{ sentiment: string; count: number }>;

      let bullVotes = 0;
      let bearVotes = 0;
      for (const r of rows) {
        if (r.sentiment === 'bull') bullVotes = Number(r.count);
        if (r.sentiment === 'bear') bearVotes = Number(r.count);
      }
      const totalVotes = bullVotes + bearVotes;
      const bullPercent = totalVotes > 0 ? Math.round((bullVotes / totalVotes) * 100) : 50;
      const bearPercent = totalVotes > 0 ? 100 - bullPercent : 50;

      let userVote: 'bull' | 'bear' | undefined;
      if (userAddress) {
        const u = this.db
          .prepare(
            `SELECT sentiment FROM token_sentiment WHERE LOWER(token_address) = LOWER(?) AND LOWER(user_address) = LOWER(?) LIMIT 1`,
          )
          .get(tokenAddress, userAddress) as { sentiment?: string } | undefined;
        if (u?.sentiment) userVote = u.sentiment as 'bull' | 'bear';
      }

      return { bullVotes, bearVotes, totalVotes, bullPercent, bearPercent, userVote };
    } catch {
      return { bullVotes: 0, bearVotes: 0, totalVotes: 0, bullPercent: 50, bearPercent: 50 };
    }
  }

  async voteTokenSentiment(
    tokenAddress: string,
    userAddress: string,
    sentiment: 'bull' | 'bear',
  ): Promise<{
    bullVotes: number;
    bearVotes: number;
    totalVotes: number;
    bullPercent: number;
    bearPercent: number;
    userVote: 'bull' | 'bear';
  }> {
    this.db
      .prepare(
        `INSERT INTO token_sentiment (token_address, user_address, sentiment, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(token_address, user_address) DO UPDATE SET
           sentiment = excluded.sentiment,
           updated_at = excluded.updated_at`,
      )
      .run(tokenAddress.toLowerCase(), userAddress.toLowerCase(), sentiment, Date.now());

    const result = await this.getTokenSentiment(tokenAddress, userAddress);
    return {
      ...result,
      userVote: sentiment,
    };
  }

  async recordBuybackBurn(burn: {
    tokenAddress: string;
    network: string;
    wethSpent: string;
    tokensBurned: string;
    transactionHash: string;
    timestamp: number;
  }): Promise<void> {
    const id = `burn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.db
      .prepare(
        `INSERT OR REPLACE INTO buyback_burns (id, token_address, network, weth_spent, tokens_burned, transaction_hash, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        burn.tokenAddress.toLowerCase(),
        burn.network,
        burn.wethSpent,
        burn.tokensBurned,
        burn.transactionHash,
        burn.timestamp,
      );
  }

  async getBuybackStats(tokenAddress?: string): Promise<{
    totalBurns: number;
    totalTokensBurned: string;
    recentBurns: Array<{
      id: string;
      tokenAddress: string;
      network: string;
      wethSpent: string;
      tokensBurned: string;
      transactionHash: string;
      timestamp: number;
    }>;
  }> {
    try {
      let query = `SELECT * FROM buyback_burns`;
      const params: string[] = [];
      if (tokenAddress) {
        query += ` WHERE LOWER(token_address) = LOWER(?)`;
        params.push(tokenAddress);
      }
      query += ` ORDER BY timestamp DESC LIMIT 20`;

      const rows = this.db.prepare(query).all(...params) as Array<{
        id: string;
        token_address: string;
        network: string;
        weth_spent: string;
        tokens_burned: string;
        transaction_hash: string;
        timestamp: number;
      }>;
      let totalTokens = 0n;
      for (const r of rows) {
        try {
          totalTokens += BigInt(r.tokens_burned);
        } catch {
          // ignore parsing error
        }
      }

      return {
        totalBurns: rows.length,
        totalTokensBurned: totalTokens.toString(),
        recentBurns: rows.map((r) => ({
          id: r.id,
          tokenAddress: r.token_address,
          network: r.network,
          wethSpent: r.weth_spent,
          tokensBurned: r.tokens_burned,
          transactionHash: r.transaction_hash,
          timestamp: Number(r.timestamp),
        })),
      };
    } catch {
      return { totalBurns: 0, totalTokensBurned: '0', recentBurns: [] };
    }
  }
}
