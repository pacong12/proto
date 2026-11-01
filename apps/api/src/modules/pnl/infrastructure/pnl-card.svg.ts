import qrcode from 'qrcode-generator';
import type { ChartPoint, PnlCard } from '../application/pnl-card';

/** The card is a link preview: 1200×630, the Open Graph size. */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const C = {
  background: '#09090b',
  border: '#27272a',
  text: '#ffffff',
  muted: '#a1a1aa',
  grid: '#18181b',
  brand: '#E7239F',
  gain: '#22c55e',
  loss: '#ef4444',
  entry: '#f59e0b',
};

/** The chart's box on the card. */
const CHART = { left: 560, right: 1150, top: 180, bottom: 586 };

/** Text safe inside an XML element, without the control characters XML does not allow. */
const escapeXml = (text: string) =>
  Array.from(text)
    .filter((c) => c >= ' ')
    .join('')
    .replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** At most `max` characters, with an ellipsis when cut. */
const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

/** A USD amount: whole dollars from $10K, compact from $1M, two significant digits below $1. */
export function formatUsd(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) return `$${compact(abs)}`;
  if (abs >= 1e4) return `$${Math.round(abs).toLocaleString('en-US')}`;
  if (abs >= 1 || abs === 0) {
    return `$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${abs.toPrecision(2)}`;
}

/** 3.7K, 9.6M, 1.2B. */
export function compact(value: number): string {
  for (const [size, unit] of [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ] as const) {
    if (value >= size) return `${(value / size).toFixed(value / size < 100 ? 1 : 0)}${unit}`;
  }
  return value.toFixed(value < 10 ? 2 : 0);
}

/** 0.98%, 5.4%, 5,725%: more decimals for smaller changes, without a sign. */
export function formatPercent(value: number): string {
  const abs = Math.abs(value);
  const digits = abs < 1 ? 2 : abs < 10 ? 1 : 0;
  return `${abs.toLocaleString('en-US', { maximumFractionDigits: digits })}%`;
}

const marketCap = (value: number | null) => (value === null ? '—' : `$${compact(value)}`);

/** The token logo in a rounded square, or the token's initial when it has none. */
function tokenLogo(card: PnlCard): string {
  const box = `x="56" y="48" width="72" height="72"`;
  if (card.logo) {
    return `<clipPath id="logo"><rect ${box} rx="16"/></clipPath>
      <image href="${card.logo}" ${box} clip-path="url(#logo)" preserveAspectRatio="xMidYMid slice"/>
      <rect ${box} rx="16" fill="none" stroke="${C.border}" stroke-width="2"/>`;
  }
  const initial = escapeXml((card.share.token.symbol || card.share.token.name || '?').slice(0, 1));
  return `<rect ${box} rx="16" fill="${C.grid}" stroke="${C.border}" stroke-width="2"/>
    <text x="92" y="97" text-anchor="middle" font-size="34" font-weight="700" fill="${C.text}">${initial.toUpperCase()}</text>`;
}

/** The left column: token, trader, PnL and the entry/exit figures. */
function summary(card: PnlCard): string {
  const { token, traderName, pnl } = card.share;
  const color = pnl.totalUsd >= 0 ? C.gain : C.loss;
  const total = `${pnl.totalUsd >= 0 ? '+' : '−'}${formatUsd(pnl.totalUsd)}`;
  // Inter Bold figures are about 0.63em wide; the column is 460px.
  const totalSize = Math.min(88, Math.floor(460 / (total.length * 0.63)));
  const percent =
    pnl.percent === null
      ? ''
      : `<path d="${pnl.percent >= 0 ? 'M56 364 L66 350 L76 364 Z' : 'M56 350 L66 364 L76 350 Z'}" fill="${color}"/>
    <text x="86" y="366" font-size="30" font-weight="700" fill="${color}">${formatPercent(pnl.percent)}</text>`;
  const holding = pnl.status === 'holding';
  const badge = holding ? 'Holding' : 'Sold';
  const rows: Array<[string, string]> = [
    ['Invested', formatUsd(pnl.investedUsd)],
    ['Average entry', marketCap(pnl.avgEntryMarketCapUsd)],
    holding
      ? ['Market cap', marketCap(pnl.marketCapUsd)]
      : ['Exit', marketCap(pnl.avgExitMarketCapUsd)],
  ];
  return `${tokenLogo(card)}
    <text x="148" y="80" font-size="32" font-weight="700" fill="${C.text}">${escapeXml(clip(token.name, 18))}</text>
    <text x="148" y="112" font-size="22" fill="${C.muted}">$${escapeXml(clip(token.symbol, 16))}</text>
    <circle cx="70" cy="214" r="14" fill="${C.brand}"/>
    <text x="70" y="220" text-anchor="middle" font-size="16" font-weight="700" fill="${C.text}">${escapeXml(
      traderName.slice(0, 1).toUpperCase(),
    )}</text>
    <text x="96" y="222" font-size="24" font-weight="600" fill="${C.text}">${escapeXml(clip(traderName, 20))}</text>
    <rect x="${496 - badge.length * 11 - 20}" y="198" width="${badge.length * 11 + 20}" height="32" rx="8" fill="${
      holding ? C.gain : C.border
    }"/>
    <text x="${486}" y="221" text-anchor="end" font-size="18" font-weight="600" fill="${
      holding ? C.background : C.text
    }">${badge}</text>
    <text x="52" y="318" font-size="${totalSize}" font-weight="700" fill="${color}">${total}</text>
    ${percent}
    ${rows
      .map(
        (
          [label, value],
          i,
        ) => `<line x1="56" x2="496" y1="${436 + i * 52}" y2="${436 + i * 52}" stroke="${C.border}"/>
    <text x="56" y="${472 + i * 52}" font-size="22" fill="${C.muted}">${label}</text>
    <text x="496" y="${472 + i * 52}" text-anchor="end" font-size="24" font-weight="700" fill="${C.text}">${value}</text>`,
      )
      .join('\n')}`;
}

/** A QR code of the page as one path of dark modules, in a white rounded box at (x, y). */
function qr(url: string, x: number, y: number, size: number): string {
  const code = qrcode(0, 'M');
  code.addData(url);
  code.make();
  const count = code.getModuleCount();
  const pad = 8;
  const cell = (size - pad * 2) / count;
  let d = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (code.isDark(r, c)) {
        d += `M${(x + pad + c * cell).toFixed(2)} ${(y + pad + r * cell).toFixed(2)}h${cell.toFixed(2)}v${cell.toFixed(2)}h-${cell.toFixed(2)}z`;
      }
    }
  }
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="14" fill="#ffffff"/>
    <path d="${d}" fill="${C.background}"/>`;
}

/** Maps chart values to the chart box; a log scale once the values span more than 20×. */
function scales(points: ChartPoint[], extra: number[]) {
  const values = [...points.map((p) => p.marketCapUsd), ...extra].filter((v) => v > 0);
  const times = points.map((p) => p.t);
  const t0 = Math.min(...times);
  const t1 = Math.max(...times, t0 + 1);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (!(lo > 0) || !(hi > 0)) [lo, hi] = [1, 2];
  const log = hi / lo > 20;
  const f = (v: number) => (log ? Math.log(Math.max(v, lo)) : v);
  const [a, b] = hi === lo ? [f(lo) * 0.9, f(hi) * 1.1] : [f(lo), f(hi)];
  const top = CHART.top + 24;
  const bottom = CHART.bottom - 24;
  return {
    x: (t: number) => CHART.left + ((t - t0) / (t1 - t0)) * (CHART.right - CHART.left - 16),
    y: (v: number) => bottom - ((f(v) - a) / (b - a || 1)) * (bottom - top),
  };
}

/**
 * The dashed average-entry line, labelled at the right end (early buys sit on the left), above or
 * below the line: on the side where fewer of the `drawn` points (the line and the markers) fall.
 */
function averageEntry(entryY: number, drawn: Array<{ x: number; y: number }>): string {
  const width = 140;
  const height = 26;
  const left = CHART.right - width - 40;
  const hits = (top: number) =>
    drawn.filter(
      (p) =>
        p.x > left - 14 && p.x < left + width + 14 && p.y > top - 14 && p.y < top + height + 14,
    ).length;
  const above = entryY - height - 6;
  const below = entryY + 6;
  const top =
    below + height > CHART.bottom || (above >= CHART.top && hits(above) <= hits(below))
      ? above
      : below;
  return `<line x1="${CHART.left}" x2="${CHART.right}" y1="${entryY}" y2="${entryY}" stroke="${C.entry}" stroke-width="2" stroke-dasharray="8 8"/>
    <rect x="${left}" y="${top}" width="${width}" height="${height}" rx="6" fill="${C.background}" fill-opacity="0.85"/>
    <text x="${left + width / 2}" y="${top + 19}" text-anchor="middle" font-size="16" font-weight="600" fill="${C.entry}">Average entry</text>`;
}

/** The right column: the market cap since before the first trade, with the wallet's trades. */
function chart(card: PnlCard): string {
  const points = card.chart.filter((p) => p.marketCapUsd > 0);
  const grid = Array.from({ length: 5 }, (_, i) => {
    const y = CHART.top + (i * (CHART.bottom - CHART.top)) / 4;
    return `<line x1="${CHART.left}" x2="${CHART.right}" y1="${y}" y2="${y}" stroke="${C.grid}" stroke-width="2"/>`;
  }).join('');
  if (points.length < 2) return grid;
  const { pnl } = card.share;
  const color = pnl.totalUsd >= 0 ? C.gain : C.loss;
  const entry = pnl.avgEntryMarketCapUsd;
  const { x, y } = scales(points, entry ? [entry] : []);
  const last = points[points.length - 1];
  const first = points[0];
  const linePoints = points.map((p) => ({ x: x(p.t), y: y(p.marketCapUsd) }));
  const line = linePoints.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
  const area = `${line.join('')}L${x(last.t).toFixed(1)} ${CHART.bottom}L${x(first.t).toFixed(1)} ${CHART.bottom}Z`;
  const trades = card.trades
    .filter((t) => t.t >= first.t && t.marketCapUsd > 0)
    .map((t) => ({ x: x(Math.min(t.t, last.t)), y: y(t.marketCapUsd), isBuy: t.isBuy }));
  const entryLine = entry ? averageEntry(y(entry), [...linePoints, ...trades]) : '';
  const markers = trades
    .map(
      (
        t,
      ) => `<circle cx="${t.x.toFixed(1)}" cy="${t.y.toFixed(1)}" r="12" fill="${t.isBuy ? C.gain : C.loss}" stroke="${C.background}" stroke-width="2"/>
      <text x="${t.x.toFixed(1)}" y="${(t.y + 5).toFixed(1)}" text-anchor="middle" font-size="14" font-weight="700" fill="${C.background}">${t.isBuy ? 'B' : 'S'}</text>`,
    )
    .join('');
  return `${grid}
    <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </linearGradient>
    <path d="${area}" fill="url(#area)"/>
    <path d="${line.join('')}" fill="none" stroke="${color}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
    ${entryLine}
    ${markers}
    <circle cx="${x(last.t)}" cy="${y(last.marketCapUsd)}" r="14" fill="${color}" fill-opacity="0.25"/>
    <circle cx="${x(last.t)}" cy="${y(last.marketCapUsd)}" r="7" fill="${color}"/>`;
}

/** The PnL card as an SVG document; `brandLogo` is the Goton mark as an image href. */
export function pnlCardSvg(card: PnlCard, brandLogo: string, siteHost: string): string {
  const glow = card.share.pnl.totalUsd >= 0 ? C.gain : C.loss;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" font-family="Inter">
  <defs>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${glow}" stop-opacity="0.16"/>
      <stop offset="1" stop-color="${glow}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="brand" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${C.brand}" stop-opacity="0.18"/>
      <stop offset="1" stop-color="${C.brand}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${C.background}"/>
  <circle cx="230" cy="300" r="320" fill="url(#glow)"/>
  <circle cx="1080" cy="40" r="360" fill="url(#brand)"/>
  <line x1="528" x2="528" y1="0" y2="${CARD_HEIGHT}" stroke="${C.border}" stroke-width="2"/>
  ${summary(card)}
  <image href="${brandLogo}" x="852" y="56" width="40" height="44"/>
  <text x="904" y="78" font-size="28" font-weight="700" fill="${C.text}">Goton</text>
  <text x="904" y="102" font-size="16" fill="${C.muted}">${escapeXml(siteHost)}</text>
  ${qr(card.pageUrl, 1036, 28, 120)}
  ${chart(card)}
</svg>`;
}
