import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import type { TradeEventEntity } from '@goton/shared-types';
import { PnlService, positionPnl, type PnlCard } from '../src/modules/pnl';
import { NotFoundError } from '../src/core/errors/app-error';
import {
  compact,
  formatPercent,
  formatUsd,
  pnlCardSvg,
} from '../src/modules/pnl/infrastructure/pnl-card.svg';
import { cidOf, IpfsImageLoader } from '../src/modules/pnl/infrastructure/ipfs-image.loader';
import { ResvgPnlCardRenderer } from '../src/modules/pnl/infrastructure/resvg-pnl-card.renderer';

const WALLET = '0x00000000000000000000000000000000000000aa';
const TOKEN = '0x1000000000000000000000000000000000000001';
let clock = 0;
/** A trade of `amount` tokens at `price` USD each. */
const trade = (isBuy: boolean, amount: number, price: number) =>
  ({
    isBuy,
    tokenAmount: String(amount),
    priceUsd: price,
    timestamp: ++clock * 1000,
  }) as TradeEventEntity;

describe('positionPnl', () => {
  it('realizes sells against the average cost and values the rest at the current price', () => {
    // 100 @ $1 + 100 @ $3 (average $2), sell 50 @ $4, now $5.
    const pnl = positionPnl(
      [trade(true, 100, 1), trade(true, 100, 3), trade(false, 50, 4)],
      5,
      1000,
    );
    expect(pnl.investedUsd).toBe(400);
    expect(pnl.proceedsUsd).toBe(200);
    expect(pnl.realizedUsd).toBe(100); // 200 - 50 × 2
    expect(pnl.unrealizedUsd).toBe(450); // 150 × 5 - 150 × 2
    expect(pnl.totalUsd).toBe(550);
    expect(pnl.percent).toBe(137.5);
    expect(pnl.avgEntryMarketCapUsd).toBe(2000);
    expect(pnl.avgExitMarketCapUsd).toBe(4000);
    expect(pnl.marketCapUsd).toBe(5000);
    expect([pnl.buys, pnl.sells, pnl.status]).toEqual([2, 1, 'holding']);
  });

  it('uses the cost of what was held at each sell, in trade order', () => {
    // Trades arrive newest first; buy 10 @ $1, sell all @ $2, buy 10 @ $4, now $4.
    const trades = [trade(true, 10, 1), trade(false, 10, 2), trade(true, 10, 4)].reverse();
    const pnl = positionPnl(trades, 4, 1);
    expect(pnl.realizedUsd).toBe(10);
    expect(pnl.unrealizedUsd).toBe(0);
  });

  it('marks a position sold out and costs sells beyond the bought tokens at nothing', () => {
    const pnl = positionPnl([trade(true, 10, 1), trade(false, 15, 2)], 9, 1);
    expect(pnl.status).toBe('sold');
    expect(pnl.holdingTokens).toBe(0);
    expect(pnl.realizedUsd).toBe(20); // 30 proceeds - the 10 the trades bought
  });

  it('has no percent without an investment', () => {
    expect(positionPnl([trade(false, 10, 1)], 1, 1).percent).toBeNull();
  });
});

describe('PnlService', () => {
  const rendered: PnlCard[] = [];
  const service = (trades: TradeEventEntity[], known = true) =>
    new PnlService({
      trades: { getTradesByTrader: async () => trades },
      profiles: { getProfile: async () => null },
      getTokenByAddress: {
        execute: async () =>
          known
            ? ({
                token: { address: TOKEN, name: 'Cat', symbol: 'CAT', logo: '', chainId: 4663 },
                marketData: { priceUsd: 2, marketCapUsd: 2000 },
              } as never)
            : null,
      },
      getCandlesticks: {
        execute: async () => [1, 2, 3].map((p) => ({ timestamp: p * 1000, close: p }) as never),
      },
      renderer: { render: async (card) => (rendered.push(card), new Uint8Array([1])) },
      images: { pngDataUrl: async () => 'data:image/png;base64,' },
    });

  it('describes the position with a generated name when the wallet has no profile', async () => {
    const share = await service([trade(true, 10, 1)]).share(WALLET, TOKEN);
    expect(share.traderName).toMatch(/^[A-Z][a-z]+[A-Z]/);
    expect(share.token.chainId).toBe(4663);
    expect(share.pnl.totalUsd).toBe(10);
  });

  it('reports an unknown token or a wallet without trades as not found', async () => {
    await expect(service([trade(true, 1, 1)], false).share(WALLET, TOKEN)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(service([]).share(WALLET, TOKEN)).rejects.toMatchObject({ code: 'NO_POSITION' });
  });

  it('renders the market cap chart with the trades on it', async () => {
    clock = Date.now() / 1000 - 10;
    await service([trade(true, 10, 1)]).card(WALLET, TOKEN, 'https://goton.fun/pnl/x');
    const card = rendered.at(-1)!;
    expect(card.trades).toEqual([{ t: clock * 1000, marketCapUsd: 1000, isBuy: true }]);
    // Candles close at the last trade; the line ends at the live market cap ($2 × 1,000).
    expect(card.chart.at(-1)?.marketCapUsd).toBe(2000);
    expect(card.pageUrl).toBe('https://goton.fun/pnl/x');
  });
});

describe('PnL card', () => {
  const card = (name: string): PnlCard => ({
    share: {
      wallet: WALLET,
      traderName: 'Trader',
      token: { address: TOKEN, name, symbol: 'CAT', logo: '', chainId: 4663 },
      pnl: positionPnl([trade(true, 10, 1)], 2, 1000),
    },
    chart: [
      { t: 1, marketCapUsd: 1000 },
      { t: 2, marketCapUsd: 2000 },
    ],
    trades: [{ t: 1, marketCapUsd: 1000, isBuy: true }],
    logo: null,
    pageUrl: 'https://goton.fun/pnl/x',
  });

  it('formats amounts, market caps and percentages', () => {
    expect(formatUsd(35229.4)).toBe('$35,229');
    expect(formatUsd(615.321)).toBe('$615.32');
    expect(formatUsd(-0.00219)).toBe('$0.0022');
    expect(formatUsd(2_500_000)).toBe('$2.5M');
    expect(compact(3700)).toBe('3.7K');
    expect(compact(9_600_000)).toBe('9.6M');
    expect(formatPercent(5725.2)).toBe('5,725%');
    expect(formatPercent(-0.977)).toBe('0.98%');
  });

  it('escapes the token name, which its creator chose', () => {
    const svg = pnlCardSvg(card('<script>&"'), 'data:', 'goton.fun');
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&#60;script&#62;&#38;&#34;');
  });

  it('renders a 1200×630 PNG', async () => {
    const png = await new ResvgPnlCardRenderer('goton.fun').render(card('Cat'));
    const meta = await sharp(Buffer.from(png)).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['png', 1200, 630]);
  });
});

describe('IpfsImageLoader', () => {
  it('reads CIDs from ipfs:// URIs and gateway or API URLs only', () => {
    expect(cidOf('ipfs://bafkreiabc')).toBe('bafkreiabc');
    expect(cidOf('https://ipfs.io/ipfs/QmAbc')).toBe('QmAbc');
    expect(cidOf('/api/ipfs/bafkreiabc')).toBe('bafkreiabc');
    expect(cidOf('https://example.com/logo.png')).toBeNull();
  });

  it('turns a WebP logo into a square PNG, and gives up on what it cannot read', async () => {
    const webp = await sharp({
      create: { width: 300, height: 200, channels: 3, background: '#E7239F' },
    })
      .webp()
      .toBuffer();
    const files: Record<string, Buffer> = { webp, junk: Buffer.from('not an image') };
    const loader = new IpfsImageLoader({
      getFile: async (cid) => (files[cid] ? { data: files[cid], mimeType: 'image/webp' } : null),
    });
    const url = await loader.pngDataUrl('ipfs://webp');
    const png = Buffer.from(url!.split(',')[1], 'base64');
    expect(await sharp(png).metadata()).toMatchObject({ format: 'png', width: 128, height: 128 });
    expect(await loader.pngDataUrl('ipfs://junk')).toBeNull();
    expect(await loader.pngDataUrl('https://example.com/logo.png')).toBeNull();
  });

  it('draws the card without a logo that loads too slowly', async () => {
    const loader = new IpfsImageLoader({ getFile: () => new Promise(() => {}) }, 20);
    expect(await loader.pngDataUrl('ipfs://slow')).toBeNull();
  });
});
