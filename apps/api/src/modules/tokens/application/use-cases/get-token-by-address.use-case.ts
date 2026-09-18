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

    const isArc =
      token.pairedToken?.toLowerCase() === '0x3600000000000000000000000000000000000000' ||
      token.poolAddress?.toLowerCase() === '0x48844223abdceeb1Ce502f54d559681358e68200';

    const quoteAssetPrice = isArc ? 1.0 : ethPriceUsd;

    let spotPriceNative: number | undefined;
    let pairedPrincipalWei = graduation.pairedPrincipal;
    let thresholdWei: bigint | undefined;

    if (token.version === 'v2' && !token.isGraduated) {
      const initialBuy = parseFloat(token.initialBuyAmount || '0');
      // Arc Chain Minara standard: 4,200 USDC opening FDV, 1B supply
      const virtualReserve = isArc ? 4200.0 + initialBuy : 3.0 + initialBuy;
      const virtualTokens = 1_000_000_000;
      spotPriceNative = virtualReserve / virtualTokens;
      pairedPrincipalWei = BigInt(Math.floor(initialBuy * 1e18));
      thresholdWei = isArc
        ? 69_000_000_000_000_000_000_000n // 69K USDC graduation target (~73.86% curve supply)
        : 4_200_000_000_000_000_000n;
    }

    const marketData = this.calculatePricing.execute({
      address: token.address,
      sqrtPriceX96: slot0.sqrtPriceX96,
      spotPriceNative,
      isToken0: token.isToken0,
      pairedPrincipalWei,
      ethPriceUsd: quoteAssetPrice,
      thresholdWei,
    });

    await this.tokenRepository.saveMarketData(marketData);

    return {
      token,
      marketData,
    };
  }
}
