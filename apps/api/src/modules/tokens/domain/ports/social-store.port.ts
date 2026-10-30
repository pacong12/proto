import { TokenCommentEntity, type CreatorProfile } from '@goton/shared-types';

/** Comments, callouts, follows and creator profiles. */
export interface SocialStorePort {
  findAddressByIdentity?(nameOrSlug: string): Promise<string | null>;
  // Discussion comments & sentiment voting
  saveComment?(comment: TokenCommentEntity): Promise<void>;
  getComments?(tokenAddress: string, viewerAddress?: string): Promise<TokenCommentEntity[]>;
  getFeedCallouts?(
    limit?: number,
    offset?: number,
    viewerAddress?: string,
    authorAddress?: string,
  ): Promise<import('@goton/shared-types').FeedCalloutItem[]>;
  getCalloutThread?(
    calloutId: string,
    viewerAddress?: string,
  ): Promise<import('@goton/shared-types').FeedCalloutItem | null>;
  /** Follows (addresses are compared lowercase). Toggles and returns the new state. */
  toggleFollow?(
    follower: string,
    followee: string,
  ): Promise<{ following: boolean; followers: number }>;
  getFollowStats?(
    address: string,
    viewer?: string,
  ): Promise<{ followers: number; following: number; isFollowing: boolean }>;
  /** Newest first. */
  listFollows?(
    address: string,
    direction: 'followers' | 'following',
    limit?: number,
  ): Promise<Array<{ address: string; since: number }>>;
  toggleCommentLike?(
    commentId: string,
    userAddress: string,
  ): Promise<{ liked: boolean; likesCount: number }>;
  toggleCommentRepost?(
    commentId: string,
    userAddress: string,
  ): Promise<{ reposted: boolean; repostsCount: number }>;
  incrementCommentViews?(commentId: string): Promise<number>;
  // Sentiment voting
  getProfile?(address: string): Promise<CreatorProfile | null>;
  saveProfile?(address: string, profile: CreatorProfile): Promise<void>;
  /** GRC-04: erase off-chain social data tied to a wallet. */
  deleteUserData?(address: string): Promise<{
    comments: number;
    likes: number;
    reposts: number;
    sentiment: number;
    profile: number;
  }>;
}
