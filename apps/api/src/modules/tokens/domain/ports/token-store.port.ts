import { LaunchedTokenEntity, TokenMarketData } from '@goton/shared-types';

/** Tokens, their market data and holders, and the indexer cursor. */
export interface TokenStorePort {
  save(token: LaunchedTokenEntity): Promise<void>;
  findByAddress(address: `0x${string}`): Promise<LaunchedTokenEntity | null>;
  findAll(
    limit?: number,
    offset?: number,
    filters?: { version?: 'v1' | 'v2'; deployer?: string },
  ): Promise<LaunchedTokenEntity[]>;
  /** Look up a single token by its Uniswap pool address. Avoids full-table JS scans. */
  findByPoolAddress?(poolAddress: `0x${string}`): Promise<LaunchedTokenEntity | null>;
  saveMarketData(marketData: TokenMarketData): Promise<void>;
  getMarketData(address: `0x${string}`): Promise<TokenMarketData | null>;
  /**
   * Tokens whose market data is missing or was last written before `olderThanMs`, oldest first.
   * Used to keep list prices current (USD values move with the quote price, 24h volume ages out).
   */
  findStaleMarketData?(olderThanMs: number, limit: number): Promise<`0x${string}`[]>;
  /** Stores on-chain balances; a zero balance removes the holder. */
  saveBalances?(
    tokenAddress: `0x${string}`,
    balances: Array<{ holder: `0x${string}`; balance: bigint }>,
  ): Promise<void>;
  /** Marks a token whose Transfer history since launch is indexed: getHolders then uses balances. */
  markHoldersIndexed?(tokenAddress: `0x${string}`): Promise<void>;
  getHolderIndexedTokens?(): Promise<Set<string>>;
  // Indexer persistence
  getLastIndexedBlock?(networkName: string): Promise<bigint | null>;
  setLastIndexedBlock?(networkName: string, blockNumber: bigint): Promise<void>;
  getTokenSentiment?(
    tokenAddress: string,
    userAddress?: string,
  ): Promise<{
    bullVotes: number;
    bearVotes: number;
    totalVotes: number;
    bullPercent: number;
    bearPercent: number;
    userVote?: 'bull' | 'bear';
  }>;
  voteTokenSentiment?(
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
  }>;
  // Buyback and Burn tracking
  recordBuybackBurn?(burn: {
    tokenAddress: string;
    network: string;
    wethSpent: string;
    tokensBurned: string;
    transactionHash: string;
    timestamp: number;
  }): Promise<void>;
  getBuybackStats?(tokenAddress?: string): Promise<{
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
  }>;
}
