import {
  chartPriceUsd,
  getUserIdentity,
  resolveTokenNetwork,
  type PnlPosition,
  type PnlShare,
  type PnlTrader,
  type TradeEventEntity,
  type WalletPnl,
} from '@goton/shared-types';
import { assertAddress, NotFoundError } from '../../../core/errors/app-error';
import type { SocialStorePort } from '../../tokens';
import type { TradeStorePort } from '../../tokens';
import type {
  GetTokenByAddressUseCase,
  TokenDetailResult,
} from '../../tokens';
import type { GetCandlesticksUseCase } from '../../trades';
import { positionPnl } from '../domain/position-pnl';
import type { ChartPoint, ImageLoaderPort, PnlCard, PnlCardRendererPort } from './pnl-card';

/** Most trades of one wallet that are read (in one token, or in all of them). */
const MAX_TRADES = 5000;
/** Most tokens a wallet's position list covers (those traded most recently). */
const MAX_POSITIONS = 50;
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

  /** The wallet's position in every token it traded (held or sold), newest trade first. */
  async positions(wallet: string): Promise<WalletPnl> {
    assertAddress(wallet, 'Wallet address');
    const [trader, trades] = await Promise.all([
      this.trader(wallet),
      this.deps.trades.getTradesByTrader(wallet, MAX_TRADES),
    ]);
    // Trades come newest first, so the map keeps tokens in order of their latest trade.
    const byToken = new Map<string, TradeEventEntity[]>();
    for (const t of trades) {
      const key = t.tokenAddress.toLowerCase();
      const list = byToken.get(key);
      if (list) list.push(t);
      else byToken.set(key, [t]);
    }
    const positions = await Promise.all(
      [...byToken].slice(0, MAX_POSITIONS).map(async ([address, tokenTrades]) => {
        const detail = await this.deps.getTokenByAddress.execute(address as `0x${string}`);
        return detail ? toPosition(detail, tokenTrades).position : null;
      }),
    );
    return { ...trader, positions: positions.filter((p): p is PnlPosition => p !== null) };
  }

  /** The PNG card of the position; `pageUrl` is where the card links to. */
  async card(wallet: string, tokenAddress: string, pageUrl: string): Promise<Uint8Array> {
    const { share, trades, supply, quotePriceUsd } = await this.position(wallet, tokenAddress);
    const [chart, logo] = await Promise.all([
      this.chart(share, supply),
      share.token.logo ? this.deps.images.pngDataUrl(share.token.logo) : null,
    ]);
    const card: PnlCard = {
      share,
      chart,
      trades: trades.slice(0, CHART_MARKERS).map((t) => ({
        t: t.timestamp,
        marketCapUsd: chartPriceUsd(t, quotePriceUsd) * supply,
        isBuy: t.isBuy,
      })),
      logo,
      pageUrl,
    };
    return this.deps.renderer.render(card);
  }

  private async position(wallet: string, tokenAddress: string) {
    assertAddress(wallet, 'Wallet address');
    assertAddress(tokenAddress);
    const [detail, trades, trader] = await Promise.all([
      this.deps.getTokenByAddress.execute(tokenAddress),
      this.deps.trades.getTradesByTrader(wallet, MAX_TRADES, tokenAddress),
      this.trader(wallet),
    ]);
    if (!detail) throw new NotFoundError('Token not found', 'TOKEN_NOT_FOUND');
    if (trades.length === 0) {
      throw new NotFoundError('This wallet has no trades of this token', 'NO_POSITION');
    }
    const { position, supply } = toPosition(detail, trades);
    const share: PnlShare = { ...trader, ...position };
    // The quote asset's USD price now, which the chart's candles are priced at (chartPriceUsd).
    const { priceUsd, priceInWeth } = detail.marketData;
    const quotePriceUsd = priceInWeth > 0 ? priceUsd / priceInWeth : undefined;
    return { share, trades: trades as readonly TradeEventEntity[], supply, quotePriceUsd };
  }

  private async trader(wallet: string): Promise<PnlTrader> {
    const profile = await this.deps.profiles.getProfile?.(wallet);
    return {
      wallet: wallet.toLowerCase() as `0x${string}`,
      traderName: profile?.displayName || getUserIdentity(wallet).name,
    };
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

/** The PnL of `trades` in a token at its current price; `supply` turns prices into market caps. */
function toPosition(
  { token, marketData }: TokenDetailResult,
  trades: readonly TradeEventEntity[],
): { position: PnlPosition; supply: number } {
  const supply = marketData.priceUsd > 0 ? marketData.marketCapUsd / marketData.priceUsd : 0;
  return {
    supply,
    position: {
      token: {
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        logo: token.logo,
        chainId: resolveTokenNetwork(token).chainId,
      },
      pnl: positionPnl(trades, marketData.priceUsd, supply),
    },
  };
}
