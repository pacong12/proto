import {
  LaunchedTokenEntity,
  TokenMarketData,
  ARC_CHAIN,
  ROBINHOOD_CHAIN,
  resolveTokenNetwork,
} from '@goton/shared-types';
import { TokenRepositoryPort } from '../../domain/ports/token.repository.port';
import { ChainIndexerPort } from '../../domain/ports/chain.indexer.port';
import { PriceFeedPort } from '../../domain/ports/price-feed.port';
import { CalculatePricingUseCase } from './calculate-pricing.use-case';

export interface TokenDetailResult {
  token: LaunchedTokenEntity;
  marketData: TokenMarketData;
}

/** How long an address that no chain knows is remembered as unknown. */
export const UNKNOWN_TOKEN_TTL_MS = 60_000;

export class GetTokenByAddressUseCase {
  /**
   * Addresses that no chain recognised, until when. Without this every request for an unknown
   * address cost up to four RPC calls, which made the endpoint slow (p99 ~1.8s under load) and let
   * anyone amplify random-address requests into RPC traffic.
   */
  private readonly unknownUntil = new Map<string, number>();
  /** Lookups in progress, so concurrent requests for one address share a single RPC round. */
  private readonly inflight = new Map<string, Promise<LaunchedTokenEntity | null>>();

  constructor(
    private readonly tokenRepository: TokenRepositoryPort,
    private readonly chainIndexer: ChainIndexerPort,
    private readonly calculatePricing: CalculatePricingUseCase,
    private readonly priceFeed: PriceFeedPort,
    private readonly now: () => number = Date.now,
  ) {}

  /** Looks the address up on every chain at once; earlier entries win, as in the sequential order. */
  private async hydrateFromChain(address: `0x${string}`): Promise<LaunchedTokenEntity | null> {
    const key = address.toLowerCase();
    const until = this.unknownUntil.get(key);
    if (until !== undefined) {
      if (until > this.now()) return null;
      this.unknownUntil.delete(key);
    }
    const pending = this.inflight.get(key);
    if (pending) return pending;

    const idx = this.chainIndexer;
    const attempts: Array<Promise<LaunchedTokenEntity | null>> = [];
    if (typeof idx.fetchV2LaunchedTokenFromFactory === 'function') {
      attempts.push(idx.fetchV2LaunchedTokenFromFactory(address, ARC_CHAIN));
      attempts.push(idx.fetchV2LaunchedTokenFromFactory(address, ROBINHOOD_CHAIN));
    }
    if (typeof idx.fetchLaunchedTokenFromChain === 'function') {
      attempts.push(idx.fetchLaunchedTokenFromChain(address, ROBINHOOD_CHAIN));
      attempts.push(idx.fetchLaunchedTokenFromChain(address, ARC_CHAIN));
    }
    const lookup = Promise.all(attempts.map((a) => a.catch(() => null)))
      .then(async (results) => {
        const token = results.find((t): t is LaunchedTokenEntity => Boolean(t)) ?? null;
        if (token) await this.tokenRepository.save(token);
        else this.unknownUntil.set(key, this.now() + UNKNOWN_TOKEN_TTL_MS);
        return token;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, lookup);
    return lookup;
  }

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

  /**
   * Compute total trading volume in USD for the last 24 hours.
   * Sums wethAmount (native quote) for all trades in the 24h window and multiplies
   * by quoteAssetPriceUsd (1.0 for Arc/USDC, live ETH price for Robinhood).
   * Uses the same 500-trade fetch as computePriceChange24h; trades are stored DESC.
   */
  private async computeVolume24h(
    address: `0x${string}`,
    quoteAssetPriceUsd: number,
  ): Promise<number> {
    const cutoff = Date.now() - 86_400_000; // ms
    const trades = await this.tokenRepository.getTrades(address, 500, 0);
    return trades
      .filter((t) => (t.timestamp ?? 0) >= cutoff)
      .reduce((sum, t) => sum + parseFloat(t.wethAmount || '0') * quoteAssetPriceUsd, 0);
  }

  async execute(address: `0x${string}`): Promise<TokenDetailResult | null> {
    // The database is checked first, so a token indexed after a negative lookup shows up at once.
    const token =
      (await this.tokenRepository.findByAddress(address)) ?? (await this.hydrateFromChain(address));

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
      // Recompute volume24hUsd from trades — calculatePricing does not have access to trades,
      // so it always emits 0. We compute it here and include it in the saved market data.
      const volume24hUsd = await this.computeVolume24h(token.address, quoteAssetPriceUsd);
      const marketDataWithChange = { ...marketData, priceChange24h, volume24hUsd };

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
    const volume24hUsd = await this.computeVolume24h(token.address, quoteAssetPriceUsd);
    const marketDataWithChange = { ...marketData, priceChange24h, volume24hUsd };

    // Fire-and-forget: market data write must not block the GET response path.
    void this.tokenRepository.saveMarketData(marketDataWithChange);

    return { token, marketData: marketDataWithChange };
  }
}
