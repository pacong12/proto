import {
  LaunchedTokenEntity,
  TokenMarketData,
  TradeEventEntity,
  CandlestickEntity,
  TokenCommentEntity,
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
    fillGaps = false,
  ): Promise<CandlestickEntity[]> {
    const token = await this.findByAddress(tokenAddress.toLowerCase() as `0x${string}`);
    const mkt = await this.getMarketData(tokenAddress.toLowerCase() as `0x${string}`);
    const trades = this.trades.get(tokenAddress.toLowerCase()) ?? [];
    return aggregateCandlesticks(trades, resolutionSeconds, {
      startTime: token?.createdAt,
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

  async getTradesByTrader(trader: string, limit = 50): Promise<TradeEventEntity[]> {
    const target = trader.toLowerCase();
    const all = Array.from(this.trades.values()).flat();
    return all
      .filter((t) => t.trader.toLowerCase() === target)
      .sort((a, b) => b.timestamp - a.timestamp)
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
    const viewer = viewerAddress?.toLowerCase();
    return list.map((c) => ({
      ...c,
      isLikedByViewer: viewer ? (this.commentLikes.get(c.id)?.has(viewer) ?? false) : false,
      isRepostedByViewer: viewer ? (this.commentReposts.get(c.id)?.has(viewer) ?? false) : false,
      viewsCount: this.commentViews.get(c.id) ?? c.viewsCount ?? 0,
    }));
  }

  async getFeedCallouts(
    limit = 50,
    offset = 0,
    viewerAddress?: string,
    authorAddress?: string,
  ): Promise<import('@proto/shared-types').FeedCalloutItem[]> {
    let allComments: import('@proto/shared-types').FeedCalloutItem[] = [];
    const viewer = viewerAddress?.toLowerCase();

    for (const [tokenAddr, list] of this.comments.entries()) {
      const token = this.tokens.get(tokenAddr);
      const mkt = this.marketData.get(tokenAddr);
      for (const c of list) {
        if (authorAddress && c.authorAddress.toLowerCase() !== authorAddress.toLowerCase()) {
          continue;
        }
        allComments.push({
          ...c,
          isLikedByViewer: viewer ? (this.commentLikes.get(c.id)?.has(viewer) ?? false) : false,
          isRepostedByViewer: viewer ? (this.commentReposts.get(c.id)?.has(viewer) ?? false) : false,
          viewsCount: this.commentViews.get(c.id) ?? c.viewsCount ?? 0,
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
  ): Promise<import('@proto/shared-types').FeedCalloutItem | null> {
    for (const [tokenAddr, list] of this.comments.entries()) {
      const match = list.find((c) => c.id === calloutId);
      if (match) {
        const token = this.tokens.get(tokenAddr);
        const mkt = this.marketData.get(tokenAddr);
        const viewer = viewerAddress?.toLowerCase();
        return {
          ...match,
          isLikedByViewer: viewer ? (this.commentLikes.get(match.id)?.has(viewer) ?? false) : false,
          isRepostedByViewer: viewer ? (this.commentReposts.get(match.id)?.has(viewer) ?? false) : false,
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
