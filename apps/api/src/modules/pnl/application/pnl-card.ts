import type { PnlShare } from '@goton/shared-types';

/** A point of the card's chart: the token's market cap at a time (ms). */
export interface ChartPoint {
  t: number;
  marketCapUsd: number;
}

/** What the PnL card shows. */
export interface PnlCard {
  share: PnlShare;
  /** The token's market cap from shortly before the wallet's first trade until now. */
  chart: ChartPoint[];
  /** The wallet's trades on that chart. */
  trades: Array<ChartPoint & { isBuy: boolean }>;
  /** The token logo as a PNG data URL, or null to draw its initial. */
  logo: string | null;
  /** The shared page, for the QR code. */
  pageUrl: string;
}

/** Draws a PNG of a PnL card. */
export interface PnlCardRendererPort {
  render(card: PnlCard): Promise<Uint8Array>;
}

/** Loads an image (an ipfs:// URI or a URL) as a small PNG data URL. */
export interface ImageLoaderPort {
  pngDataUrl(uri: string): Promise<string | null>;
}
