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
    return aggregateCandlesticks(trades, resolutionSeconds);
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

  async findTradeByHash(txHash: string): Promise<TradeEventEntity | null> {
    const hash = txHash.toLowerCase();
    for (const list of this.trades.values()) {
      const match = list.find((t) => t.transactionHash.toLowerCase() === hash);
      if (match) return match;
    }
    return null;
  }

  private comments = new Map<string, TokenCommentEntity[]>();
  private commentLikes = new Map<string, Set<string>>();
  private votes = new Map<string, Map<string, 'bullish' | 'bearish'>>();

  async saveComment(comment: TokenCommentEntity): Promise<void> {
    const key = comment.tokenAddress.toLowerCase();
    const existing = this.comments.get(key) ?? [];
    existing.unshift(comment);
    this.comments.set(key, existing);
  }

  async getComments(tokenAddress: string, viewerAddress?: string): Promise<TokenCommentEntity[]> {
    const key = tokenAddress.toLowerCase();
    const list = this.comments.get(key) ?? [];
    const viewer = viewerAddress?.toLowerCase();
    return list.map((c) => ({
      ...c,
      isLikedByViewer: viewer ? (this.commentLikes.get(c.id)?.has(viewer) ?? false) : false,
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

  async saveVote(
    tokenAddress: string,
    userAddress: string,
    voteType: 'bullish' | 'bearish',
  ): Promise<void> {
    const tokenKey = tokenAddress.toLowerCase();
    let tokenVoteMap = this.votes.get(tokenKey);
    if (!tokenVoteMap) {
      tokenVoteMap = new Map();
      this.votes.set(tokenKey, tokenVoteMap);
    }
    tokenVoteMap.set(userAddress.toLowerCase(), voteType);
  }

  async getVotes(tokenAddress: string, viewerAddress?: string): Promise<TokenVotesSummary> {
    const tokenKey = tokenAddress.toLowerCase();
    const tokenVoteMap = this.votes.get(tokenKey) ?? new Map();
    let bullishCount = 0;
    let bearishCount = 0;
    for (const v of tokenVoteMap.values()) {
      if (v === 'bullish') bullishCount++;
      else if (v === 'bearish') bearishCount++;
    }
    const totalVotes = bullishCount + bearishCount;
    const bullishPercent = totalVotes > 0 ? Math.round((bullishCount / totalVotes) * 100) : 50;
    const viewer = viewerAddress?.toLowerCase();
    const viewerVote = viewer ? tokenVoteMap.get(viewer) : undefined;
    return {
      tokenAddress,
      bullishCount,
      bearishCount,
      totalVotes,
      bullishPercent,
      viewerVote,
    };
  }
}
