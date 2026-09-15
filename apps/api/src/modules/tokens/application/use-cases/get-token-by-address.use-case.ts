import { LaunchedTokenEntity, TokenMarketData } from '@proto/shared-types';
import { TokenRepositoryPort } from '../../domain/ports/token.repository.port';
import { ChainIndexerPort } from '../../domain/ports/chain.indexer.port';
import { PriceFeedPort } from '../../domain/ports/price-feed.port';
import { CalculatePricingUseCase } from './calculate-pricing.use-case';

export interface TokenDetailResult {
  token: LaunchedTokenEntity;
  marketData: TokenMarketData;
}

export class GetTokenByAddressUseCase {
  constructor(
    private readonly tokenRepository: TokenRepositoryPort,
    private readonly chainIndexer: ChainIndexerPort,
    private readonly calculatePricing: CalculatePricingUseCase,
    private readonly priceFeed: PriceFeedPort,
  ) {}

  async execute(address: `0x${string}`): Promise<TokenDetailResult | null> {
    let token = await this.tokenRepository.findByAddress(address);

    if (!token) {
      token = await this.chainIndexer.fetchLaunchedTokenFromChain(address);
      if (token) {
        await this.tokenRepository.save(token);
      }
    }

    if (!token) return null;

    const [slot0, graduation, ethPriceUsd] = await Promise.all([
      this.chainIndexer.fetchPoolSlot0(token.poolAddress),
      this.chainIndexer.fetchGraduationStatus(token.address),
      this.priceFeed.getEthPriceUsd(),
    ]);

    const marketData = this.calculatePricing.execute({
      address: token.address,
      sqrtPriceX96: slot0.sqrtPriceX96,
      isToken0: token.isToken0,
      pairedPrincipalWei: graduation.pairedPrincipal,
      ethPriceUsd,
    });

    await this.tokenRepository.saveMarketData(marketData);

    return {
      token,
      marketData,
    };
  }
}
