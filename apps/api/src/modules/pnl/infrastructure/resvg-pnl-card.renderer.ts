import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Resvg } from '@resvg/resvg-js';
import type { PnlCard, PnlCardRendererPort } from '../application/pnl-card';
import { CARD_WIDTH, pnlCardSvg } from './pnl-card.svg';

const require = createRequire(import.meta.url);

/** Inter in the weights the card uses, from @expo-google-fonts/inter (OFL). */
const FONT_FILES = [
  '400Regular/Inter_400Regular',
  '600SemiBold/Inter_600SemiBold',
  '700Bold/Inter_700Bold',
].map((name) => require.resolve(`@expo-google-fonts/inter/${name}.ttf`));

const BRAND_LOGO = `data:image/svg+xml;base64,${readFileSync(
  new URL('./assets/goton-logo.svg', import.meta.url),
).toString('base64')}`;

/** Draws the card as SVG and renders it to PNG with resvg, with the card's own fonts only. */
export class ResvgPnlCardRenderer implements PnlCardRendererPort {
  /** `siteHost` is shown under the brand (e.g. goton.fun). */
  constructor(private readonly siteHost: string) {}

  async render(card: PnlCard): Promise<Uint8Array> {
    const svg = pnlCardSvg(card, BRAND_LOGO, this.siteHost);
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: CARD_WIDTH },
      font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Inter' },
    });
    return resvg.render().asPng();
  }
}
