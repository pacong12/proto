import {
  LaunchedTokenEntity,
  TokenMarketData,
  TradeEventEntity,
  CandlestickEntity,
  TokenCommentEntity,
  getUserIdentity,
  chartPriceUsd,
  type CreatorProfile,
} from '@goton/shared-types';
import type { TokenRepositoryPort, TradeFlow } from '../../domain/ports/token.repository.port';
import {
  aggregateCandlesticks,
  chartStartTime,
  computeHoldersDistribution,
} from '../../domain/services/token-aggregation.service';

export class InMemoryTokenRepository implements TokenRepositoryPort {
  private tokens = new Map<string, LaunchedTokenEntity>();
  private marketData = new Map<string, TokenMarketData>();
  private marketDataUpdatedAt = new Map<string, number>();
  private trades = new Map<string, TradeEventEntity[]>();

  async save(token: LaunchedTokenEntity): Promise<void> {
    this.tokens.set(token.address.toLowerCase(), token);
  }

  private profiles = new Map<string, CreatorProfile>();

  async getProfile(address: string): Promise<CreatorProfile | null> {
    return this.profiles.get(address.toLowerCase()) ?? null;
  }

  async saveProfile(address: string, profile: CreatorProfile): Promise<void> {
    this.profiles.set(address.toLowerCase(), profile);
  }

  async findByAddress(address: `0x${string}`): Promise<LaunchedTokenEntity | null> {
    return this.tokens.get(address.toLowerCase()) ?? null;
  }

  async findAll(
    limit = 50,
    offset = 0,
    filters?: { version?: 'v1' | 'v2'; deployer?: string },
  ): Promise<LaunchedTokenEntity[]> {
    let all = Array.from(this.tokens.values()).reverse();
    if (filters?.version) all = all.filter((t) => (t.version ?? 'v1') === filters.version);
    if (filters?.deployer) {
      const d = filters.deployer.toLowerCase();
      all = all.filter((t) => t.deployer.toLowerCase() === d);
    }
    return all.slice(offset, offset + limit);
  }

  async saveMarketData(data: TokenMarketData): Promise<void> {
    this.marketData.set(data.address.toLowerCase(), {
      ...data,
      priceChange24h: data.priceChange24h ?? 0,
    });
    this.marketDataUpdatedAt.set(data.address.toLowerCase(), Date.now());
  }

  async getTradeFlow(tokenAddress: `0x${string}`, sinceMs: number): Promise<TradeFlow> {
    const trades = (this.trades.get(tokenAddress.toLowerCase()) ?? []).filter(
      (t) => t.timestamp >= sinceMs,
    );
    const side = (isBuy: boolean) => trades.filter((t) => t.isBuy === isBuy);
    const sum = (list: typeof trades) =>
      list.reduce((a, t) => a + parseFloat(t.wethAmount || '0'), 0);
    const distinct = (list: typeof trades) => new Set(list.map((t) => t.trader.toLowerCase())).size;
    return {
      buyQuote: sum(side(true)),
      sellQuote: sum(side(false)),
      buys: side(true).length,
      sells: side(false).length,
      buyers: distinct(side(true)),
      sellers: distinct(side(false)),
    };
  }

  async findStaleMarketData(olderThanMs: number, limit: number): Promise<`0x${string}`[]> {
    const all = await this.findAll(Number.MAX_SAFE_INTEGER, 0);
    return all
      .map((t) => ({
        address: t.address,
        at: this.marketDataUpdatedAt.get(t.address.toLowerCase()) ?? 0,
      }))
      .filter((t) => t.at < olderThanMs)
      .sort((a, b) => a.at - b.at)
      .slice(0, limit)
      .map((t) => t.address);
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

  async getPriceAnchor(
    tokenAddress: `0x${string}`,
    cutoffMs: number,
  ): Promise<TradeEventEntity | null> {
    const byTime = [...(this.trades.get(tokenAddress.toLowerCase()) ?? [])].sort(
      (x, y) => x.timestamp - y.timestamp,
    );
    return byTime.filter((t) => t.timestamp <= cutoffMs).pop() ?? byTime[0] ?? null;
  }

  async getCandlesticks(
    tokenAddress: `0x${string}`,
    resolutionSeconds = 60,
    fillGaps = false,
    quotePriceUsd?: number,
  ): Promise<CandlestickEntity[]> {
    const token = await this.findByAddress(tokenAddress.toLowerCase() as `0x${string}`);
    const mkt = await this.getMarketData(tokenAddress.toLowerCase() as `0x${string}`);
    const trades = (this.trades.get(tokenAddress.toLowerCase()) ?? []).map((t) => ({
      ...t,
      priceUsd: chartPriceUsd(t, quotePriceUsd),
    }));
    return aggregateCandlesticks(trades, resolutionSeconds, {
      startTime: chartStartTime(
        token?.createdAt,
        trades.length ? Math.min(...trades.map((t) => t.timestamp)) : undefined,
      ),
      endTime: Date.now(),
      fillGaps,
      maxCandles: 1000,
      fallbackPrice: mkt?.priceUsd || 0,
    });
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

  async getTradesByTrader(
    trader: string,
    limit = 50,
    tokenAddress?: string,
  ): Promise<TradeEventEntity[]> {
    const target = trader.toLowerCase();
    const token = tokenAddress?.toLowerCase();
    const all = Array.from(this.trades.values()).flat();
    return all
      .filter((t) => t.trader.toLowerCase() === target)
      .filter((t) => !token || t.tokenAddress.toLowerCase() === token)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async getTradesInBlockRange(
    fromBlock: bigint,
    toBlock: bigint,
    limit: number,
  ): Promise<TradeEventEntity[]> {
    return Array.from(this.trades.values())
      .flat()
      .filter((t) => {
        const bn = BigInt(t.blockNumber ?? 0);
        return bn >= fromBlock && (toBlock === 0n || bn <= toBlock);
      })
      .sort((a, b) => Number(BigInt(a.blockNumber ?? 0) - BigInt(b.blockNumber ?? 0)))
      .slice(0, limit);
  }

  async getTradesSince(sinceMs: number): Promise<TradeEventEntity[]> {
    const all = Array.from(this.trades.values()).flat();
    return all.filter((t) => t.timestamp >= sinceMs).sort((a, b) => a.timestamp - b.timestamp);
  }

  async findTradeByHash(txHash: string): Promise<TradeEventEntity | null> {
    const hash = txHash.toLowerCase();
    for (const list of this.trades.values()) {
      const match = list.find((t) => t.transactionHash.toLowerCase() === hash);
      if (match) return match;
    }
    return null;
  }

  async findAddressByIdentity(nameOrSlug: string): Promise<string | null> {
    const q = nameOrSlug.toLowerCase().trim().replace(/^@/, '');
    if (!q) return null;
    if (/^0x[a-f0-9]{40}$/i.test(q)) return q.toLowerCase();

    const addrs = new Set<string>();
    for (const t of this.tokens.values()) addrs.add(t.deployer.toLowerCase());
    for (const list of this.trades.values()) {
      for (const tr of list) addrs.add(tr.trader.toLowerCase());
    }

    for (const addr of addrs) {
      const id = getUserIdentity(addr);
      if (
        id.name.toLowerCase() === q ||
        id.displayName.toLowerCase() === q ||
        id.slug.toLowerCase() === q ||
        id.tag.toLowerCase() === q
      ) {
        return addr;
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
    const positions = [];
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
    const target = poolAddress.toLowerCase();
    for (const token of this.tokens.values()) {
      if (token.poolAddress.toLowerCase() === target) return token;
    }
    return null;
  }

  async getVolumeByToken(
    sinceMs: number,
  ): Promise<Array<{ tokenAddress: string; totalWeth: number }>> {
    const acc = new Map<string, number>();
    for (const [addr, trades] of this.trades) {
      let total = 0;
      for (const t of trades) {
        if (t.timestamp >= sinceMs) total += parseFloat(t.wethAmount);
      }
      if (total > 0) acc.set(addr, total);
    }
    return Array.from(acc.entries()).map(([tokenAddress, totalWeth]) => ({
      tokenAddress,
      totalWeth,
    }));
  }

  private comments = new Map<string, TokenCommentEntity[]>();
  private commentLikes = new Map<string, Set<string>>();
  private commentReposts = new Map<string, Set<string>>();
  private commentViews = new Map<string, number>();

  async saveComment(comment: TokenCommentEntity): Promise<void> {
    const key = comment.tokenAddress.toLowerCase();
    const existing = this.comments.get(key) ?? [];
    existing.unshift({ ...comment, viewsCount: comment.viewsCount || 0 });
    this.comments.set(key, existing);
  }

  async getComments(tokenAddress: string, viewerAddress?: string): Promise<TokenCommentEntity[]> {
    const key = tokenAddress.toLowerCase();
    const list = this.comments.get(key) ?? [];
    return list.map((c) => this.withViewerState(c, viewerAddress));
  }

  /** A comment with the viewer's like/repost flags and its current view count. */
  private withViewerState<C extends TokenCommentEntity>(c: C, viewerAddress?: string): C {
    const viewer = viewerAddress?.toLowerCase();
    return {
      ...c,
      isLikedByViewer: viewer ? (this.commentLikes.get(c.id)?.has(viewer) ?? false) : false,
      isRepostedByViewer: viewer ? (this.commentReposts.get(c.id)?.has(viewer) ?? false) : false,
      viewsCount: this.commentViews.get(c.id) ?? c.viewsCount ?? 0,
    };
  }

  async getFeedCallouts(
    limit = 50,
    offset = 0,
    viewerAddress?: string,
    authorAddress?: string,
  ): Promise<import('@goton/shared-types').FeedCalloutItem[]> {
    const allComments: import('@goton/shared-types').FeedCalloutItem[] = [];

    for (const [tokenAddr, list] of this.comments.entries()) {
      const token = this.tokens.get(tokenAddr);
      const mkt = this.marketData.get(tokenAddr);
      for (const c of list) {
        if (authorAddress && c.authorAddress.toLowerCase() !== authorAddress.toLowerCase()) {
          continue;
        }
        allComments.push({
          ...this.withViewerState(c, viewerAddress),
          tokenName: token?.name,
          tokenSymbol: token?.symbol,
          tokenLogo: token?.logo,
          tokenMarketCapUsd: mkt?.marketCapUsd,
          tokenPriceUsd: mkt?.priceUsd,
        });
      }
    }

    allComments.sort((a, b) => b.createdAt - a.createdAt);
    return allComments.slice(offset, offset + limit);
  }

  async incrementCommentViews(commentId: string): Promise<number> {
    const current = (this.commentViews.get(commentId) ?? 0) + 1;
    this.commentViews.set(commentId, current);
    return current;
  }

  async getCalloutThread(
    calloutId: string,
    viewerAddress?: string,
  ): Promise<import('@goton/shared-types').FeedCalloutItem | null> {
    for (const [tokenAddr, list] of this.comments.entries()) {
      const match = list.find((c) => c.id === calloutId);
      if (match) {
        const token = this.tokens.get(tokenAddr);
        const mkt = this.marketData.get(tokenAddr);
        const viewer = viewerAddress?.toLowerCase();
        return {
          ...match,
          isLikedByViewer: viewer ? (this.commentLikes.get(match.id)?.has(viewer) ?? false) : false,
          isRepostedByViewer: viewer
            ? (this.commentReposts.get(match.id)?.has(viewer) ?? false)
            : false,
          tokenName: token?.name,
          tokenSymbol: token?.symbol,
          tokenLogo: token?.logo,
          tokenMarketCapUsd: mkt?.marketCapUsd,
          tokenPriceUsd: mkt?.priceUsd,
          replies: [],
        };
      }
    }
    return null;
  }

  private follows = new Map<string, number>(); // "follower|followee" -> created at

  async toggleFollow(
    follower: string,
    followee: string,
  ): Promise<{ following: boolean; followers: number }> {
    const key = `${follower.toLowerCase()}|${followee.toLowerCase()}`;
    const following = !this.follows.has(key);
    if (following) this.follows.set(key, Date.now());
    else this.follows.delete(key);
    return { following, followers: (await this.getFollowStats(followee)).followers };
  }

  async getFollowStats(
    address: string,
    viewer?: string,
  ): Promise<{ followers: number; following: number; isFollowing: boolean }> {
    const a = address.toLowerCase();
    const keys = [...this.follows.keys()].map((k) => k.split('|'));
    return {
      followers: keys.filter(([, b]) => b === a).length,
      following: keys.filter(([f]) => f === a).length,
      isFollowing: viewer ? this.follows.has(`${viewer.toLowerCase()}|${a}`) : false,
    };
  }

  async listFollows(
    address: string,
    direction: 'followers' | 'following',
    limit = 100,
  ): Promise<Array<{ address: string; since: number }>> {
    const a = address.toLowerCase();
    return [...this.follows]
      .map(([k, since]) => ({ pair: k.split('|'), since }))
      .filter(({ pair }) => (direction === 'followers' ? pair[1] === a : pair[0] === a))
      .sort((x, y) => y.since - x.since)
      .slice(0, limit)
      .map(({ pair, since }) => ({
        address: direction === 'followers' ? pair[0] : pair[1],
        since,
      }));
  }

  async toggleCommentLike(
    commentId: string,
    userAddress: string,
  ): Promise<{ liked: boolean; likesCount: number }> {
    const user = userAddress.toLowerCase();
    let set = this.commentLikes.get(commentId);
    if (!set) {
      set = new Set<string>();
      this.commentLikes.set(commentId, set);
    }
    const liked = set.has(user);
    if (liked) {
      set.delete(user);
    } else {
      set.add(user);
    }
    const likesCount = set.size;
    // update comment in list
    for (const list of this.comments.values()) {
      const match = list.find((c) => c.id === commentId);
      if (match) match.likesCount = likesCount;
    }
    return { liked: !liked, likesCount };
  }

  async toggleCommentRepost(
    commentId: string,
    userAddress: string,
  ): Promise<{ reposted: boolean; repostsCount: number }> {
    const user = userAddress.toLowerCase();
    let set = this.commentReposts.get(commentId);
    if (!set) {
      set = new Set<string>();
      this.commentReposts.set(commentId, set);
    }
    const reposted = set.has(user);
    if (reposted) {
      set.delete(user);
    } else {
      set.add(user);
    }
    const repostsCount = set.size;
    // update comment in list
    for (const list of this.comments.values()) {
      const match = list.find((c) => c.id === commentId);
      if (match) match.repostsCount = repostsCount;
    }
    return { reposted: !reposted, repostsCount };
  }
}
