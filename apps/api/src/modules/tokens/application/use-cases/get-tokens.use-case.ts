import { LaunchedTokenEntity, TokenMarketData } from '@proto/shared-types';
import { TokenRepositoryPort } from '../../domain/ports/token.repository.port';

export interface TokenWithMarketData {
  token: LaunchedTokenEntity;
  marketData: TokenMarketData | null;
}

export class GetTokensUseCase {
  constructor(private readonly tokenRepository: TokenRepositoryPort) {}

  async execute(limit = 50, offset = 0): Promise<TokenWithMarketData[]> {
    const tokens = await this.tokenRepository.findAll(limit, offset);
    const result: TokenWithMarketData[] = [];

    for (const token of tokens) {
      const marketData = await this.tokenRepository.getMarketData(token.address);
      result.push({
        token,
        marketData,
      });
    }

    return result;
  }
}
