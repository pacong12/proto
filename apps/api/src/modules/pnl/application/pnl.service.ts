import {
  getUserIdentity,
  resolveTokenNetwork,
  type PnlShare,
  type TradeEventEntity,
} from '@goton/shared-types';
import { assertAddress, NotFoundError } from '../../../core/errors/app-error';
import type { SocialStorePort } from '../../tokens/domain/ports/social-store.port';
import type { TradeStorePort } from '../../tokens/domain/ports/trade-store.port';
import type { GetTokenByAddressUseCase } from '../../tokens/application/use-cases/get-token-by-address.use-case';
import type { GetCandlesticksUseCase } from '../../trades/application/use-cases/get-candlesticks.use-case';
import { positionPnl } from '../domain/position-pnl';
import type { ChartPoint, ImageLoaderPort, PnlCard, PnlCardRendererPort } from './pnl-card';

/** Most trades of one wallet in one token that are read. */
const MAX_TRADES = 5000;
/** Candle widths the chart picks from, narrowest first (VALID_RESOLUTIONS). */
const CHART_RESOLUTIONS = [60, 300, 900, 3600, 14400, 86400];
/** Most points the chart draws. */
const CHART_POINTS = 200;
/** Most trade markers the chart draws (the newest). */
const CHART_MARKERS = 40;

export interface PnlServiceDeps {
  trades: Required<Pick<TradeStorePort, 'getTradesByTrader'>>;
  profiles: Pick<SocialStorePort, 'getProfile'>;
  getTokenByAddress: Pick<GetTokenByAddressUseCase, 'execute'>;
  getCandlesticks: Pick<GetCandlesticksUseCase, 'execute'>;
  renderer: PnlCardRendererPort;
  images: ImageLoaderPort;
}

/** A wallet's PnL on a token, for the shared PnL page and its card. */
export class PnlService {
  constructor(private readonly deps: PnlServiceDeps) {}

  async share(wallet: string, tokenAddress: string): Promise<PnlShare> {
    return (await this.position(wallet, tokenAddress)).share;
  }

  /** The PNG card of the position; `pageUrl` is where the card links to. */
  async card(wallet: string, tokenAddress: string, pageUrl: string): Promise<Uint8Array> {
    const { share, trades, supply } = await this.position(wallet, tokenAddress);
    const [chart, logo] = await Promise.all([
      this.chart(share, supply),
      share.token.logo ? this.deps.images.pngDataUrl(share.token.logo) : null,
    ]);
    const card: PnlCard = {
      share,
      chart,
      trades: trades
        .slice(0, CHART_MARKERS)
        .map((t) => ({ t: t.timestamp, marketCapUsd: t.priceUsd * supply, isBuy: t.isBuy })),
      logo,
      pageUrl,
    };
    return this.deps.renderer.render(card);
  }

  private async position(wallet: string, tokenAddress: string) {
    assertAddress(wallet, 'Wallet address');
    assertAddress(tokenAddress);
    const [detail, trades, profile] = await Promise.all([
      this.deps.getTokenByAddress.execute(tokenAddress),
      this.deps.trades.getTradesByTrader(wallet, MAX_TRADES, tokenAddress),
      this.deps.profiles.getProfile?.(wallet) ?? null,
    ]);
    if (!detail) throw new NotFoundError('Token not found', 'TOKEN_NOT_FOUND');
    if (trades.length === 0) {
      throw new NotFoundError('This wallet has no trades of this token', 'NO_POSITION');
    }
    const { token, marketData } = detail;
    const supply = marketData.priceUsd > 0 ? marketData.marketCapUsd / marketData.priceUsd : 0;
    const share: PnlShare = {
      wallet: wallet.toLowerCase() as `0x${string}`,
      traderName: profile?.displayName || getUserIdentity(wallet).name,
      token: {
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        logo: token.logo,
        chainId: resolveTokenNetwork(token).chainId,
      },
      pnl: positionPnl(trades, marketData.priceUsd, supply),
    };
    return { share, trades: trades as readonly TradeEventEntity[], supply };
  }

  /**
   * Market caps from a little before the first trade until now, in at most CHART_POINTS, ending
   * at the current market cap: candles close at the last trade's price, the card's figures use
   * the live one.
   */
  private async chart(share: PnlShare, supply: number): Promise<ChartPoint[]> {
    const now = Date.now();
    const first = share.pnl.firstTradeAt ?? now;
    const span = Math.max(now - first, 3_600_000);
    const start = first - span * 0.1;
    const resolution =
      CHART_RESOLUTIONS.find((r) => span / (r * 1000) <= CHART_POINTS) ?? CHART_RESOLUTIONS.at(-1)!;
    const candles = await this.deps.getCandlesticks.execute(share.token.address, resolution, true);
    const chart = candles
      .filter((c) => c.timestamp >= start && c.timestamp < now)
      .map((c) => ({ t: c.timestamp, marketCapUsd: c.close * supply }));
    if (share.pnl.marketCapUsd > 0) chart.push({ t: now, marketCapUsd: share.pnl.marketCapUsd });
    return chart;
  }
}
