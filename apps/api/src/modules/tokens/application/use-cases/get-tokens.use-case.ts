import { LaunchedTokenEntity, TokenMarketData, resolveTokenNetwork } from '@goton/shared-types';
import { TokenRepositoryPort } from '../../domain/ports/token.repository.port';
import { ChainIndexerPort } from '../../domain/ports/chain.indexer.port';
import { PriceFeedPort } from '../../domain/ports/price-feed.port';
import { CalculatePricingUseCase } from './calculate-pricing.use-case';

export interface TokenWithMarketData {
  token: LaunchedTokenEntity;
  marketData: TokenMarketData | null;
}

export class GetTokensUseCase {
  constructor(
    private readonly tokenRepository: TokenRepositoryPort,
    private readonly chainIndexer?: ChainIndexerPort,
    private readonly priceFeed?: PriceFeedPort,
    private readonly calculatePricing?: CalculatePricingUseCase,
  ) {}

  async execute(
    limit = 50,
    offset = 0,
    filters?: { version?: 'v1' | 'v2'; deployer?: string },
  ): Promise<TokenWithMarketData[]> {
    const tokens = await this.tokenRepository.findAll(limit, offset, filters);
    const result: TokenWithMarketData[] = [];

    for (const token of tokens) {
      let marketData = await this.tokenRepository.getMarketData(token.address);

      // If no cached marketData and we have the required adapters, compute it live.
      if (!marketData && this.chainIndexer && this.priceFeed && this.calculatePricing) {
        try {
          const network = resolveTokenNetwork(token, token.chainId);

          if (token.version === 'v2' && token.curveAddress) {
            const [curveState, quoteUsd] = await Promise.all([
              this.chainIndexer.fetchV2CurveState(token.curveAddress, network),
              this.priceFeed.getQuoteAssetPriceUsd(network.chainId),
            ]);
            marketData = this.calculatePricing.fromCurve(token, curveState, quoteUsd);

            await this.tokenRepository.saveMarketData(marketData);
          }
        } catch {
          // Non-fatal: return token without marketData rather than failing the list
        }
      }

      result.push({ token, marketData });
    }

    return result;
  }
}
