import {
  LaunchedTokenEntity,
  TokenMarketData,
  ARC_CHAIN,
  ROBINHOOD_CHAIN,
  resolveTokenNetwork,
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

  /**
   * Derive 24h price change percentage from trade history.
   * Finds the first trade that occurred >= 24h ago and computes
   * (currentPriceUsd - price24hAgo) / price24hAgo * 100.
   * Returns 0 when there is insufficient history.
   */
  private async computePriceChange24h(
    address: `0x${string}`,
    currentPriceUsd: number,
  ): Promise<number> {
    if (currentPriceUsd <= 0) return 0;
    const cutoff = Math.floor((Date.now() - 86_400_000) / 1000); // unix seconds, 24h ago
    // Fetch enough trades to reach 24h back; 500 is sufficient for active tokens
    const trades = await this.tokenRepository.getTrades(address, 500, 0);
    // Trades are ordered DESC by timestamp; find the first one older than 24h
    const anchor = trades.find((t) => t.timestamp <= cutoff);
    if (!anchor || anchor.priceUsd <= 0) return 0;
    return ((currentPriceUsd - anchor.priceUsd) / anchor.priceUsd) * 100;
  }

  async execute(address: `0x${string}`): Promise<TokenDetailResult | null> {
    let token = await this.tokenRepository.findByAddress(address);

    // Try to hydrate from chain if not in DB yet
    if (!token) {
      if (typeof this.chainIndexer.fetchV2LaunchedTokenFromFactory === 'function') {
        token = await this.chainIndexer
          .fetchV2LaunchedTokenFromFactory(address, ARC_CHAIN)
          .catch(() => null);
        if (!token) {
          token = await this.chainIndexer
            .fetchV2LaunchedTokenFromFactory(address, ROBINHOOD_CHAIN)
            .catch(() => null);
        }
      }
      if (!token && typeof this.chainIndexer.fetchLaunchedTokenFromChain === 'function') {
        token = await this.chainIndexer
          .fetchLaunchedTokenFromChain(address, ROBINHOOD_CHAIN)
          .catch(() => null);
        if (!token) {
          token = await this.chainIndexer
            .fetchLaunchedTokenFromChain(address, ARC_CHAIN)
            .catch(() => null);
        }
      }
      if (token) await this.tokenRepository.save(token);
    }

    if (!token) return null;

    // ------------------------------------------------------------------
    // Clean Architecture: Resolve network and quote asset price per chain
    // ------------------------------------------------------------------
    const network = resolveTokenNetwork(token);
    const quoteAssetPriceUsd = await this.priceFeed.getQuoteAssetPriceUsd(network.chainId);

    // ------------------------------------------------------------------
    // V2 Bonding Curve pricing path
    // ------------------------------------------------------------------
    if (token.version === 'v2' && token.curveAddress) {
      const curveAddr = token.curveAddress as `0x${string}`;

      // Fetch live on-chain curve state — never use DB snapshot for pricing
      const curveState = await this.chainIndexer.fetchV2CurveState(curveAddr, network);

      // On-chain virtualEthReserve already includes all net ETH raised on the curve
      const vEthNum = Number(curveState.virtualEthReserve) / 1e18;
      const virtualTokensNum = Number(curveState.virtualTokenReserve) / 1e18;
      const spotPriceNative = virtualTokensNum > 0 ? vEthNum / virtualTokensNum : 0;

      const marketData = this.calculatePricing.execute({
        address: token.address,
        spotPriceNative,
        isToken0: token.isToken0,
        pairedPrincipalWei: curveState.totalEthRaised,
        ethPriceUsd: quoteAssetPriceUsd,
        thresholdWei: curveState.graduationTarget,
        totalSupply: BigInt(token.totalSupply || '1000000000000000000000000000'),
      });

      const priceChange24h = await this.computePriceChange24h(token.address, marketData.priceUsd);
      const marketDataWithChange = { ...marketData, priceChange24h };

      await this.tokenRepository.saveMarketData(marketDataWithChange);

      // Refresh stored V2 curve params
      await this.tokenRepository.save({
        ...token,
        initialBuyAmount: curveState.totalEthRaised.toString(),
        isGraduated: curveState.graduated,
        virtualEthReserve: curveState.virtualEthReserve.toString(),
        virtualTokenReserve: curveState.virtualTokenReserve.toString(),
        graduationTarget: curveState.graduationTarget.toString(),
      });

      return {
        token: { ...token, isGraduated: curveState.graduated },
        marketData: marketDataWithChange,
      };
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

    const priceChange24h = await this.computePriceChange24h(token.address, marketData.priceUsd);
    const marketDataWithChange = { ...marketData, priceChange24h };

    // Fire-and-forget: market data write must not block the GET response path.
    // SQLite write locks are per-connection; an awaited write here delays concurrent reads.
    void this.tokenRepository.saveMarketData(marketDataWithChange);

    return { token, marketData: marketDataWithChange };
  }
}
