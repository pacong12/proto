import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Database } from 'bun:sqlite';
import {
  getUserIdentity,
  type LaunchedTokenEntity,
  type TokenMarketData,
  type TradeEventEntity,
} from '@goton/shared-types';
import { aggregateCandlesticks } from '@goton/math-sdk';
import { SqliteTokenRepository } from '../src/app/storage/sqlite-token.repository';

const TOKEN = '0xAbCdEf0000000000000000000000000000000001' as `0x${string}`;
const WALLET = '0xDeF0000000000000000000000000000000000002';
const NOW = 1_700_000_000_000;

const upper = (a: string) => `0x${a.slice(2).toUpperCase()}` as `0x${string}`;
const lower = (a: string) => a.toLowerCase() as `0x${string}`;

const token: LaunchedTokenEntity = {
  address: TOKEN,
  name: 'Scale',
  symbol: 'SCL',
  decimals: 18,
  totalSupply: '1000000000000000000000000',
  logo: 'ipfs://logo',
  description: '',
  socials: {},
  deployer: WALLET as `0x${string}`,
  pairedToken: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  poolAddress: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
  isToken0: true,
  poolFee: 10000,
  positionId: 1n,
  restrictionsEndBlock: 0n,
  launchBlock: 1n,
  createdAt: NOW - 1_000_000,
  initialBuyAmount: '0',
};

const marketData: TokenMarketData = {
  address: TOKEN,
  priceInWeth: 0.1,
  priceUsd: 0.25,
  marketCapUsd: 777,
  fdvUsd: 777,
  pairedPrincipalWeth: '1',
  graduationThresholdWeth: '1',
  graduationProgress: 0,
  isGraduated: false,
  volume24hUsd: 1,
  priceChange24h: 0,
};

const trade = (id: string, over: Partial<TradeEventEntity> = {}): TradeEventEntity => ({
  id,
  tokenAddress: TOKEN,
  poolAddress: token.poolAddress,
  trader: WALLET as `0x${string}`,
  isBuy: true,
  tokenAmount: '1000',
  wethAmount: '0.5',
  priceUsd: 0.001,
  blockNumber: 1n,
  transactionHash: `0xHash${id}` as `0x${string}`,
  timestamp: NOW,
  ...over,
});

describe('SQLite queries at scale', () => {
  let repository: SqliteTokenRepository;
  let db: Database;

  /** Inserts directly: saveComment lowercases, older rows and other writers may not have. */
  const insertComment = (
    id: string,
    tokenAddress: string,
    authorAddress: string,
    createdAt: number,
    parentId: string | null = null,
  ) =>
    db
      .prepare(
        `INSERT INTO comments (id, token_address, author_address, content, created_at, parent_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, tokenAddress, authorAddress, `post ${id}`, createdAt, parentId);

  /** The plan of each statement `run` prepares: of the store's real SQL, not a copy of it. */
  const plansOf = async (run: () => Promise<unknown>): Promise<string> => {
    const prepare = db.prepare.bind(db);
    const statements: string[] = [];
    db.prepare = ((sql: string) => {
      statements.push(sql);
      return prepare(sql);
    }) as typeof db.prepare;
    await run();
    db.prepare = prepare;
    return statements
      .flatMap((sql) => db.query(`EXPLAIN QUERY PLAN ${sql}`).all() as Array<{ detail: string }>)
      .map((row) => row.detail)
      .join('\n');
  };

  beforeEach(async () => {
    repository = new SqliteTokenRepository(':memory:');
    db = (repository as unknown as { database: { db: Database } }).database.db;
    await repository.save(token);
    await repository.saveMarketData(marketData);
  });

  afterEach(() => {
    repository.close();
  });

  describe('mixed-case addresses', () => {
    it('joins a post to its token and market data however either is cased', async () => {
      insertComment('lower', lower(TOKEN), WALLET, NOW);
      insertComment('upper', upper(TOKEN), WALLET, NOW + 1);
      insertComment('mixed', TOKEN, WALLET, NOW + 2);

      const feed = await repository.getFeedCallouts(10, 0);

      expect(feed.map((item) => item.id)).toEqual(['mixed', 'upper', 'lower']);
      for (const item of feed) {
        expect(item).toMatchObject({
          tokenName: 'Scale',
          tokenSymbol: 'SCL',
          tokenLogo: 'ipfs://logo',
          tokenMarketCapUsd: 777,
          tokenPriceUsd: 0.25,
        });
      }
    });

    it('leaves the token and market fields empty for a post of an unknown token', async () => {
      insertComment('orphan', '0x00000000000000000000000000000000000000ff', WALLET, NOW);

      const [item] = await repository.getFeedCallouts(10, 0);

      expect(item.id).toBe('orphan');
      expect(item.tokenName).toBeUndefined();
      expect(item.tokenMarketCapUsd).toBeUndefined();
    });

    it('still matches on a market_data table created before its address was NOCASE', async () => {
      db.run(`ALTER TABLE market_data RENAME TO market_data_new`);
      db.run(`CREATE TABLE market_data AS SELECT * FROM market_data_new WHERE 0`);
      db.run(`DROP TABLE market_data_new`);
      db.run(`CREATE UNIQUE INDEX legacy_market_address ON market_data (address)`);
      await repository.saveMarketData(marketData);
      insertComment('lower', lower(TOKEN), WALLET, NOW);

      const [item] = await repository.getFeedCallouts(10, 0);

      expect(item.tokenPriceUsd).toBe(0.25);
      expect((await repository.getMarketData(upper(TOKEN)))?.priceUsd).toBe(0.25);
    });

    it('filters the feed by author and a token page in any case', async () => {
      insertComment('mine', TOKEN, WALLET, NOW);
      insertComment('theirs', lower(TOKEN), '0x0000000000000000000000000000000000000abc', NOW + 1);

      for (const author of [WALLET, lower(WALLET), upper(WALLET)]) {
        const posts = await repository.getFeedCallouts(10, 0, undefined, author);
        expect(posts.map((item) => item.id)).toEqual(['mine']);
      }
      for (const address of [TOKEN, lower(TOKEN), upper(TOKEN)]) {
        const posts = await repository.getComments(address);
        expect(posts.map((item) => item.id)).toEqual(['theirs', 'mine']);
      }
    });

    it('finds a viewer’s likes and reposts in any case', async () => {
      insertComment('liked', TOKEN, WALLET, NOW);
      db.prepare(`INSERT INTO comment_likes VALUES ('liked', ?, 1)`).run(WALLET);
      db.prepare(`INSERT INTO comment_reposts VALUES ('liked', ?, 1)`).run(upper(WALLET));

      for (const viewer of [WALLET, lower(WALLET), upper(WALLET)]) {
        const [item] = await repository.getFeedCallouts(10, 0, viewer);
        expect(item).toMatchObject({ isLikedByViewer: true, isRepostedByViewer: true });
      }
    });

    it('returns a thread with its joined fields, whatever the case of its replies', async () => {
      insertComment('root', TOKEN, WALLET, NOW);
      insertComment('r1', lower(TOKEN), WALLET, NOW + 1, 'root');
      insertComment('r2', upper(TOKEN), WALLET, NOW + 2, 'root');

      const thread = await repository.getCalloutThread('root');

      expect(thread).toMatchObject({ tokenName: 'Scale', tokenPriceUsd: 0.25 });
      expect(thread?.replies?.map((reply) => reply.id)).toEqual(['r1', 'r2']);
      expect(thread?.replies?.[1]).toMatchObject({ tokenSymbol: 'SCL', tokenMarketCapUsd: 777 });
    });

    it('matches a wallet’s trades and positions in any case', async () => {
      await repository.saveTrade(trade('a', { trader: lower(WALLET) }));
      await repository.saveTrade(trade('b', { trader: upper(WALLET), tokenAddress: lower(TOKEN) }));

      for (const wallet of [WALLET, lower(WALLET), upper(WALLET)]) {
        expect(await repository.getTradesByTrader(wallet)).toHaveLength(2);
        expect(await repository.getTradesByTrader(wallet, 50, upper(TOKEN))).toHaveLength(2);
        const positions = await repository.getUserPositions(wallet);
        expect(positions).toHaveLength(1);
        expect(positions[0]).toMatchObject({ symbol: 'SCL', balance: 2000, priceUsd: 0.25 });
      }
    });

    it('finds a token, its pool and a trade by hash in any case', async () => {
      await repository.saveTrade(trade('a'));

      expect((await repository.findByAddress(upper(TOKEN)))?.name).toBe('Scale');
      expect((await repository.findByPoolAddress(lower(token.poolAddress)))?.name).toBe('Scale');
      expect((await repository.findTradeByHash('0XHASHA'))?.id).toBe('a');
      expect((await repository.getCandlesticks(upper(TOKEN), 60)).length).toBe(1);
    });
  });

  describe('ordering', () => {
    it('breaks ties between posts by insertion order, as a full scan did', async () => {
      for (const id of ['c', 'a', 'b']) insertComment(id, TOKEN, WALLET, NOW);
      for (const id of ['z', 'x', 'y']) insertComment(id, TOKEN, WALLET, NOW + 1, 'c');

      const feed = await repository.getFeedCallouts(10, 0);
      const page = await repository.getComments(TOKEN);
      const thread = await repository.getCalloutThread('c');

      expect(feed.map((item) => item.id)).toEqual(['c', 'a', 'b']);
      expect(page.map((item) => item.id)).toEqual(['c', 'a', 'b']);
      expect(thread?.replies?.map((reply) => reply.id)).toEqual(['z', 'x', 'y']);
    });

    it('treats a post with an empty parent as a root post', async () => {
      insertComment('empty', TOKEN, WALLET, NOW, '');
      insertComment('reply', TOKEN, WALLET, NOW + 1, 'empty');

      const feed = await repository.getFeedCallouts(10, 0);

      expect(feed.map((item) => item.id)).toEqual(['empty']);
    });

    it('returns a wallet’s newest trades first, the latest inserted first on a tie', async () => {
      await repository.saveTrade(trade('old', { timestamp: NOW - 1 }));
      await repository.saveTrade(trade('first'));
      await repository.saveTrade(trade('second'));

      const trades = await repository.getTradesByTrader(WALLET, 2);

      expect(trades.map((row) => row.id)).toEqual(['second', 'first']);
    });

    it('orders a block range numerically, with an open end and a token filter', async () => {
      await repository.saveTrade(trade('b10', { blockNumber: 10n }));
      await repository.saveTrade(trade('b9', { blockNumber: 9n }));
      await repository.saveTrade(trade('b9-2', { blockNumber: 9n, tokenAddress: lower(TOKEN) }));
      await repository.saveTrade(trade('other', { blockNumber: 9n, tokenAddress: lower(WALLET) }));
      const ids = async (...args: [bigint, bigint, number, `0x${string}`?]) =>
        (await repository.getTradesInBlockRange(...args)).map((row) => row.id);

      expect(await ids(9n, 10n, 10)).toEqual(['b9', 'b9-2', 'other', 'b10']);
      expect(await ids(10n, 0n, 10)).toEqual(['b10']);
      expect(await ids(9n, 9n, 2)).toEqual(['b9', 'b9-2']);
      expect(await ids(9n, 0n, 10, upper(TOKEN))).toEqual(['b9', 'b9-2', 'b10']);
    });
  });

  describe('profile names', () => {
    const OTHER = '0x1110000000000000000000000000000000000003';
    afterEach(() => vi.restoreAllMocks());

    it('resolves every generated name and does not rescan for unknown ones', async () => {
      await repository.saveTrade?.(trade('named'));
      const { slug, displayName } = getUserIdentity(WALLET);
      expect(await repository.findAddressByIdentity?.(slug)).toBe(lower(WALLET));
      expect(await repository.findAddressByIdentity?.(`@${displayName}`)).toBe(lower(WALLET));

      const prepare = vi.spyOn(db, 'prepare');
      expect(await repository.findAddressByIdentity?.('nosuchuser')).toBeNull();
      expect(prepare).not.toHaveBeenCalled();
    });

    it('picks up a new wallet once the index expires', async () => {
      const start = Date.now();
      await repository.saveTrade?.(trade('first'));
      await repository.findAddressByIdentity?.('nosuchuser');
      await repository.saveTrade?.(trade('second', { trader: OTHER as `0x${string}` }));
      const { slug } = getUserIdentity(OTHER);
      expect(await repository.findAddressByIdentity?.(slug)).toBeNull();

      vi.spyOn(Date, 'now').mockReturnValue(start + 61_000);
      expect(await repository.findAddressByIdentity?.(slug)).toBe(OTHER);
    });
  });

  describe('feed token chain', () => {
    it('carries the paired token that names the chain', async () => {
      await repository.save(token);
      insertComment('c1', TOKEN, WALLET, NOW);
      const [item] = (await repository.getFeedCallouts?.(10, 0)) ?? [];
      expect(item.tokenPairedToken).toBe(lower(token.pairedToken));
    });
  });

  describe('candles', () => {
    const MINUTE = 60_000;
    /** A trade every 7 minutes for ~2 days: longer than the 1000 one-minute bars a chart keeps. */
    const history = Array.from({ length: 420 }, (_, i) =>
      trade(`h${i}`, {
        timestamp: NOW + i * 7 * MINUTE + (i % 5) * 1000,
        priceUsd: 0.001 + ((i * 37) % 101) / 100_000,
        wethAmount: String(0.1 + (i % 3) / 10),
      }),
    );
    const last = history[history.length - 1].timestamp;

    beforeEach(async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(last + 30_000);
      for (const item of history) await repository.saveTrade(item);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([60, 300, 3600])(
      'draws the same %is bars from its window as from every trade',
      async (resolution) => {
        const expected = aggregateCandlesticks(history, resolution, {
          startTime: token.createdAt,
          endTime: last + 30_000,
          fillGaps: true,
          maxCandles: 1000,
          fallbackPrice: marketData.priceUsd,
        });

        const candles = await repository.getCandlesticks(TOKEN, resolution, true);

        expect(candles).toEqual(expected);
      },
    );

    it('opens the oldest bar at the last trade before the window, not the launch price', async () => {
      const [first] = await repository.getCandlesticks(TOKEN, 60, true);
      const before = history.filter((item) => item.timestamp < first.timestamp).at(-1);

      expect(before).toBeDefined();
      expect(first.open).toBe(before?.priceUsd);
      expect(first.open).not.toBe(history[0].priceUsd);
    });

    it('still returns every bucket when gaps are not filled', async () => {
      const candles = await repository.getCandlesticks(TOKEN, 60, false);

      expect(candles).toHaveLength(history.length);
    });

    it('reads the window from an index that covers it, without touching the table', async () => {
      const plan = await plansOf(() => repository.getCandlesticks(TOKEN, 60, true));

      expect(plan).toMatch(/SEARCH trades USING COVERING INDEX idx_trades_token_candle/);
      expect(plan).not.toMatch(/SCAN trades\b/);
    });
  });

  describe('query plans', () => {
    it('reads the feed from its index, newest first, without scanning or sorting', async () => {
      const plan = await plansOf(() => repository.getFeedCallouts(30, 0));

      expect(plan).toMatch(/SCAN c USING INDEX idx_comments_feed/);
      expect(plan).toMatch(/SEARCH t USING INDEX sqlite_autoindex_tokens_1/);
      expect(plan).toMatch(/SEARCH m USING INDEX sqlite_autoindex_market_data_1/);
      expect(plan).not.toMatch(/TEMP B-TREE/);
    });

    it('filters the feed by author and viewer through an index', async () => {
      const plan = await plansOf(() => repository.getFeedCallouts(30, 0, WALLET, WALLET));

      expect(plan).toMatch(/SEARCH c USING INDEX idx_comments_author_feed/);
      expect(plan).toMatch(/SEARCH comment_likes USING INDEX idx_comment_likes_user/);
      expect(plan).toMatch(/SEARCH comment_reposts USING INDEX idx_comment_reposts_user/);
      expect(plan).not.toMatch(/\bSCAN\b|TEMP B-TREE/);
    });

    it('reads a token’s posts and a thread’s replies through an index', async () => {
      insertComment('root', TOKEN, WALLET, NOW);

      expect(await plansOf(() => repository.getComments(TOKEN))).toMatch(
        /SEARCH comments USING INDEX idx_comments_token_feed/,
      );
      const thread = await plansOf(() => repository.getCalloutThread('root'));
      expect(thread).toMatch(/SEARCH c USING INDEX idx_comments_parent/);
      expect(thread).not.toMatch(/\bSCAN\b|TEMP B-TREE/);
    });

    it('reads a wallet’s newest trades from its index without scanning or sorting', async () => {
      const plan = await plansOf(() => repository.getTradesByTrader(WALLET, 50));

      expect(plan).toMatch(/SEARCH trades USING INDEX idx_trades_trader_ts/);
      expect(plan).not.toMatch(/\bSCAN\b|TEMP B-TREE/);
    });

    it('resolves a position’s token and market data by primary key', async () => {
      const plan = await plansOf(async () => {
        await repository.findByAddress(TOKEN);
        await repository.getMarketData(TOKEN);
      });

      expect(plan).not.toMatch(/\bSCAN\b/);
    });

    it('walks a block range in order through its numeric index', async () => {
      const plan = await plansOf(() => repository.getTradesInBlockRange(1n, 2n, 10));

      expect(plan).toMatch(/SEARCH trades USING INDEX idx_trades_block_num/);
      expect(plan).not.toMatch(/\bSCAN\b|TEMP B-TREE/);
    });

    it('drops the indexes the new ones replace', () => {
      const names = (
        db.query(`SELECT name FROM sqlite_master WHERE type = 'index'`).all() as Array<{
          name: string;
        }>
      ).map((row) => row.name);

      expect(names).not.toContain('idx_trades_trader');
      expect(names).not.toContain('idx_trades_block');
      expect(names).not.toContain('idx_comments_token');
    });
  });
});
