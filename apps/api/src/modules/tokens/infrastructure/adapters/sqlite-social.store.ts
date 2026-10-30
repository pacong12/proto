import type { SocialStorePort } from '../../domain/ports/social-store.port';
import { TokenCommentEntity, getUserIdentity, type CreatorProfile } from '@goton/shared-types';

import { SqliteTradeStore } from './sqlite-trade.store';

/** Comments, callouts, follows and profiles. */
export class SqliteSocialStore extends SqliteTradeStore implements SocialStorePort {
  async getProfile(address: string): Promise<CreatorProfile | null> {
    const row = this.db
      .prepare('SELECT profile_json FROM profiles WHERE address = ? LIMIT 1')
      .get(address.toLowerCase()) as { profile_json: string } | undefined;
    return row ? (JSON.parse(row.profile_json) as CreatorProfile) : null;
  }

  async saveProfile(address: string, profile: CreatorProfile): Promise<void> {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO profiles (address, profile_json, updated_at) VALUES (?, ?, ?)',
      )
      .run(address.toLowerCase(), JSON.stringify(profile), Date.now());
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

  async saveComment(comment: TokenCommentEntity): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO comments (
        id, token_address, author_address, content, image_url, likes_count, created_at,
        target_mcap, position_usd, profit_usd, call_type, parent_id, quoted_callout_id,
        reposts_count, quotes_count, replies_count, price_at_post
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      comment.priceAtPost ?? null,
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
      price_at_post: number | null;
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
      priceAtPost: r.price_at_post != null ? Number(r.price_at_post) : undefined,
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
  ): Promise<import('@goton/shared-types').FeedCalloutItem[]> {
    let sql = `
      SELECT 
        c.id, c.token_address, c.author_address, c.content, c.image_url, 
        c.likes_count, c.created_at, c.target_mcap, c.position_usd, c.profit_usd, c.call_type,
        c.parent_id, c.quoted_callout_id, c.reposts_count, c.quotes_count, c.replies_count, c.views_count, c.supply_percent, c.price_at_post,
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
      price_at_post: number | null;
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

    const feedItems: import('@goton/shared-types').FeedCalloutItem[] = rows.map((r) => ({
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
      priceAtPost: r.price_at_post != null ? Number(r.price_at_post) : undefined,
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
  ): import('@goton/shared-types').FeedCalloutItem | null {
    const stmt = this.db.prepare(`
      SELECT 
        c.id, c.token_address, c.author_address, c.content, c.image_url, 
        c.likes_count, c.created_at, c.target_mcap, c.position_usd, c.profit_usd, c.call_type,
        c.parent_id, c.quoted_callout_id, c.reposts_count, c.quotes_count, c.replies_count, c.views_count, c.supply_percent, c.price_at_post,
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
      price_at_post: number | null;
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
      priceAtPost: r.price_at_post != null ? Number(r.price_at_post) : undefined,
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
  ): Promise<import('@goton/shared-types').FeedCalloutItem | null> {
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

  async toggleFollow(
    follower: string,
    followee: string,
  ): Promise<{ following: boolean; followers: number }> {
    const a = follower.toLowerCase();
    const b = followee.toLowerCase();
    return this.runInTransaction(() => {
      const existing = this.db
        .prepare(`SELECT 1 FROM follows WHERE follower = ? AND followee = ? LIMIT 1`)
        .get(a, b);
      if (existing) {
        this.db.prepare(`DELETE FROM follows WHERE follower = ? AND followee = ?`).run(a, b);
      } else {
        this.db
          .prepare(`INSERT INTO follows (follower, followee, created_at) VALUES (?, ?, ?)`)
          .run(a, b, Date.now());
      }
      const row = this.db
        .prepare(`SELECT COUNT(*) AS n FROM follows WHERE followee = ?`)
        .get(b) as { n: number };
      return { following: !existing, followers: Number(row.n) };
    });
  }

  async getFollowStats(
    address: string,
    viewer?: string,
  ): Promise<{ followers: number; following: number; isFollowing: boolean }> {
    const a = address.toLowerCase();
    const count = (sql: string) => Number((this.db.prepare(sql).get(a) as { n: number }).n);
    const isFollowing = viewer
      ? !!this.db
          .prepare(`SELECT 1 FROM follows WHERE follower = ? AND followee = ? LIMIT 1`)
          .get(viewer.toLowerCase(), a)
      : false;
    return {
      followers: count(`SELECT COUNT(*) AS n FROM follows WHERE followee = ?`),
      following: count(`SELECT COUNT(*) AS n FROM follows WHERE follower = ?`),
      isFollowing,
    };
  }

  async listFollows(
    address: string,
    direction: 'followers' | 'following',
    limit = 100,
  ): Promise<Array<{ address: string; since: number }>> {
    const [match, pick] =
      direction === 'followers' ? ['followee', 'follower'] : ['follower', 'followee'];
    const rows = this.db
      .prepare(
        `SELECT ${pick} AS address, created_at AS since FROM follows WHERE ${match} = ? ORDER BY created_at DESC LIMIT ?`,
      )
      .all(address.toLowerCase(), Math.min(limit, 500)) as Array<{
      address: string;
      since: number;
    }>;
    return rows.map((r) => ({ address: r.address, since: Number(r.since) }));
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

  /**
   * GRC-04 (GDPR Art. 17): erases the off-chain social data tied to a wallet — its comments, likes,
   * reposts, sentiment votes and profile — and keeps the counters on other users' posts consistent.
   * Replies written by other users stay. On-chain data (trades, launches) is public and not erasable.
   */
  async deleteUserData(address: string): Promise<{
    comments: number;
    likes: number;
    reposts: number;
    sentiment: number;
    profile: number;
  }> {
    return this.runInTransaction(() => {
      const user = address.toLowerCase();
      const changes = (r: unknown) => Number((r as { changes?: number | bigint }).changes ?? 0);

      // Counters on other users' posts
      this.db
        .prepare(
          `UPDATE comments SET likes_count = MAX(0, likes_count - 1)
           WHERE id IN (SELECT comment_id FROM comment_likes WHERE LOWER(user_address) = ?)`,
        )
        .run(user);
      this.db
        .prepare(
          `UPDATE comments SET reposts_count = MAX(0, reposts_count - 1)
           WHERE id IN (SELECT comment_id FROM comment_reposts WHERE LOWER(user_address) = ?)`,
        )
        .run(user);
      this.db
        .prepare(
          `UPDATE comments SET replies_count = MAX(0, replies_count - 1)
           WHERE id IN (SELECT parent_id FROM comments
                        WHERE LOWER(author_address) = ? AND parent_id IS NOT NULL)`,
        )
        .run(user);

      const likes = changes(
        this.db.prepare(`DELETE FROM comment_likes WHERE LOWER(user_address) = ?`).run(user),
      );
      const reposts = changes(
        this.db.prepare(`DELETE FROM comment_reposts WHERE LOWER(user_address) = ?`).run(user),
      );
      // Others' likes/reposts on the user's own comments go with those comments
      for (const table of ['comment_likes', 'comment_reposts']) {
        this.db
          .prepare(
            `DELETE FROM ${table} WHERE comment_id IN
             (SELECT id FROM comments WHERE LOWER(author_address) = ?)`,
          )
          .run(user);
      }
      const comments = changes(
        this.db.prepare(`DELETE FROM comments WHERE LOWER(author_address) = ?`).run(user),
      );
      const sentiment = changes(
        this.db.prepare(`DELETE FROM token_sentiment WHERE user_address = ?`).run(user),
      );
      const profile = changes(this.db.prepare(`DELETE FROM profiles WHERE address = ?`).run(user));
      return { comments, likes, reposts, sentiment, profile };
    });
  }
}
