import { LaunchedTokenEntity, TokenMarketData } from '@proto/shared-types';

export interface TokenRepositoryPort {
  save(token: LaunchedTokenEntity): Promise<void>;
  findByAddress(address: `0x${string}`): Promise<LaunchedTokenEntity | null>;
  findAll(limit?: number, offset?: number): Promise<LaunchedTokenEntity[]>;
  saveMarketData(marketData: TokenMarketData): Promise<void>;
  getMarketData(address: `0x${string}`): Promise<TokenMarketData | null>;
}
