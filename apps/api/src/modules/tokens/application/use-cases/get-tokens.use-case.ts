import { LaunchedTokenEntity, TokenMarketData, ARC_CHAIN } from '@proto/shared-types';
import { TokenRepositoryPort } from '../../domain/ports/token.repository.port';
import { ViemChainIndexerAdapter } from '../../infrastructure/adapters/viem-chain-indexer.adapter';
import { PriceFeedPort } from '../../domain/ports/price-feed.port';
import { CalculatePricingUseCase } from './calculate-pricing.use-case';

export interface TokenWithMarketData {
  token: LaunchedTokenEntity;
  marketData: TokenMarketData | null;
}

export class GetTokensUseCase {
  constructor(
    private readonly tokenRepository: TokenRepositoryPort,
    private readonly chainIndexer?: ViemChainIndexerAdapter,
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
          const isArc = token.pairedToken?.toLowerCase() === ARC_CHAIN.contracts.weth.toLowerCase();
          const network = isArc ? ARC_CHAIN : null;

          if (token.version === 'v2' && token.curveAddress) {
            const curveAddr = token.curveAddress as `0x${string}`;
            const curveState = await this.chainIndexer.fetchV2CurveState(
              curveAddr,
              network ?? ARC_CHAIN,
            );
            const quoteUsd = isArc ? 1.0 : await this.priceFeed.getEthPriceUsd();
            const effectiveReserve =
              Number(curveState.virtualEthReserve + curveState.totalEthRaised) / 1e18;
            const virtualTokensNum = Number(curveState.virtualTokenReserve) / 1e18;
            const spotPriceNative = virtualTokensNum > 0 ? effectiveReserve / virtualTokensNum : 0;

            marketData = this.calculatePricing.execute({
              address: token.address,
              spotPriceNative,
              isToken0: token.isToken0,
              pairedPrincipalWei: curveState.totalEthRaised,
              ethPriceUsd: quoteUsd,
              thresholdWei: curveState.graduationTarget,
              totalSupply: BigInt(token.totalSupply || '1000000000000000000000000000'),
            });

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
