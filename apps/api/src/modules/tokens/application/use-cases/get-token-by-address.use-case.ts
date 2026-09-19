import {
  LaunchedTokenEntity,
  TokenMarketData,
  ARC_CHAIN,
  ROBINHOOD_CHAIN,
} from '@proto/shared-types';
import { TokenRepositoryPort } from '../../domain/ports/token.repository.port';
import { ViemChainIndexerAdapter } from '../../infrastructure/adapters/viem-chain-indexer.adapter';
import { PriceFeedPort } from '../../domain/ports/price-feed.port';
import { CalculatePricingUseCase } from './calculate-pricing.use-case';

export interface TokenDetailResult {
  token: LaunchedTokenEntity;
  marketData: TokenMarketData;
}

export class GetTokenByAddressUseCase {
  constructor(
    private readonly tokenRepository: TokenRepositoryPort,
    private readonly chainIndexer: ViemChainIndexerAdapter,
    private readonly calculatePricing: CalculatePricingUseCase,
    private readonly priceFeed: PriceFeedPort,
  ) {}

  async execute(address: `0x${string}`): Promise<TokenDetailResult | null> {
    let token = await this.tokenRepository.findByAddress(address);

    // Try to hydrate from chain if not in DB yet
    if (!token) {
      // Try Robinhood V1 first, then Arc V1
      token = await this.chainIndexer.fetchLaunchedTokenFromChain(address, ROBINHOOD_CHAIN);
      if (!token) {
        token = await this.chainIndexer.fetchLaunchedTokenFromChain(address, ARC_CHAIN);
      }
      if (token) await this.tokenRepository.save(token);
    }

    if (!token) return null;

    // ------------------------------------------------------------------
    // Determine network
    // ------------------------------------------------------------------
    const isArc =
      token.pairedToken?.toLowerCase() === ARC_CHAIN.contracts.weth.toLowerCase() ||
      token.curveAddress?.toLowerCase() === ARC_CHAIN.contracts.factory.toLowerCase() ||
      token.curveAddress?.toLowerCase() ===
        (ARC_CHAIN.contracts.factoryV2 ?? ARC_CHAIN.contracts.factory).toLowerCase();

    const network = isArc ? ARC_CHAIN : ROBINHOOD_CHAIN;
    // USDC is always $1.00 on Arc; ETH needs oracle price on Robinhood
    const quoteAssetPriceUsd = isArc ? 1.0 : await this.priceFeed.getEthPriceUsd();

    // ------------------------------------------------------------------
    // V2 Bonding Curve pricing path
    // ------------------------------------------------------------------
    if (token.version === 'v2' && token.curveAddress) {
      const curveAddr = token.curveAddress as `0x${string}`;

      // Fetch live on-chain curve state — never use DB snapshot for pricing
      const curveState = await this.chainIndexer.fetchV2CurveState(curveAddr, network);

      // Effective reserve = virtual base + actual ETH raised to date
      const effectiveReserve =
        Number(curveState.virtualEthReserve + curveState.totalEthRaised) / 1e18;
      const virtualTokensNum = Number(curveState.virtualTokenReserve) / 1e18;
      const spotPriceNative = virtualTokensNum > 0 ? effectiveReserve / virtualTokensNum : 0;

      const marketData = this.calculatePricing.execute({
        address: token.address,
        spotPriceNative,
        isToken0: token.isToken0,
        pairedPrincipalWei: curveState.totalEthRaised,
        ethPriceUsd: quoteAssetPriceUsd,
        thresholdWei: curveState.graduationTarget,
        totalSupply: BigInt(token.totalSupply || '1000000000000000000000000000'),
      });

      await this.tokenRepository.saveMarketData(marketData);

      // Refresh stored V2 curve params
      await this.tokenRepository.save({
        ...token,
        initialBuyAmount: curveState.totalEthRaised.toString(),
        isGraduated: curveState.graduated,
        virtualEthReserve: curveState.virtualEthReserve.toString(),
        virtualTokenReserve: curveState.virtualTokenReserve.toString(),
        graduationTarget: curveState.graduationTarget.toString(),
      });

      return { token: { ...token, isGraduated: curveState.graduated }, marketData };
    }

    // ------------------------------------------------------------------
    // V1 Uniswap V3 pricing path
    // ------------------------------------------------------------------
    const [slot0, graduation] = await Promise.all([
      this.chainIndexer.fetchPoolSlot0(token.poolAddress as `0x${string}`),
      this.chainIndexer.fetchGraduationStatus(token.address, network),
    ]);

    const marketData = this.calculatePricing.execute({
      address: token.address,
      sqrtPriceX96: slot0.sqrtPriceX96,
      isToken0: token.isToken0,
      pairedPrincipalWei: graduation.pairedPrincipal,
      ethPriceUsd: quoteAssetPriceUsd,
      thresholdWei: graduation.threshold,
      totalSupply: BigInt(token.totalSupply || '1000000000000000000000000000'),
    });

    await this.tokenRepository.saveMarketData(marketData);

    return { token, marketData };
  }
}
