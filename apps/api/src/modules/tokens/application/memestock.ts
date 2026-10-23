import type { LaunchedTokenEntity, TradeEventEntity } from '@goton/shared-types';

/**
 * Memestock is the curated side of Explore: a launch is listed only when it has a thesis and its
 * creator holds a position bought on-chain, and the list is ranked by momentum.
 */

/** A thesis is at least this long and has at least MIN_THESIS_WORDS words. */
export const MIN_THESIS_LENGTH = 12;
export const MIN_THESIS_WORDS = 3;
/** A creator who sold more than this share of what they bought no longer counts as holding. */
export const MAX_CREATOR_SOLD_SHARE = 0.5;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export interface MemestockSignals {
  /** Tokens the creator bought and sold on-chain (whole tokens). */
  creatorBought: number;
  creatorSold: number;
  /** Creator's remaining bought position as a share of supply, in percent. */
  creatorHoldsPct: number;
  traders1h: number;
  traders24h: number;
  /** Buy share of 1h quote volume (0-1), or null without trades in the last hour. */
  buyPressure1h: number | null;
  score: number;
}

export function hasThesis(description?: string | null): boolean {
  const text = (description ?? '').trim();
  if (text.length < MIN_THESIS_LENGTH) return false;
  // Keyboard mash ("aspdasdkas;dka;sldk") is long enough but is not a thesis.
  const words = text.split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w));
  return words.length >= MIN_THESIS_WORDS;
}

export function memestockSignals(
  token: Pick<LaunchedTokenEntity, 'deployer' | 'totalSupply' | 'decimals'>,
  trades: TradeEventEntity[],
  now: number,
): MemestockSignals {
  const creator = token.deployer.toLowerCase();
  let creatorBought = 0;
  let creatorSold = 0;
  let buyQuote = 0;
  let sellQuote = 0;
  const traders1h = new Set<string>();
  const traders24h = new Set<string>();

  for (const trade of trades) {
    const tokens = Number(trade.tokenAmount) || 0;
    const quote = Number(trade.wethAmount) || 0;
    const trader = trade.trader.toLowerCase();
    if (trader === creator) {
      if (trade.isBuy) creatorBought += tokens;
      else creatorSold += tokens;
    }
    const age = now - trade.timestamp;
    if (age < 0) continue;
    if (age <= DAY_MS) traders24h.add(trader);
    if (age <= HOUR_MS) {
      traders1h.add(trader);
      if (trade.isBuy) buyQuote += quote;
      else sellQuote += quote;
    }
  }

  const supply = Number(BigInt(token.totalSupply || '0') / 10n ** BigInt(token.decimals ?? 18));
  const held = Math.max(0, creatorBought - creatorSold);
  const buyPressure1h = buyQuote + sellQuote > 0 ? buyQuote / (buyQuote + sellQuote) : null;
  // Fresh activity counts most; buy pressure breaks ties between equally active launches.
  const score = traders1h.size * 2 + traders24h.size * 0.25 + (buyPressure1h ?? 0.5);

  return {
    creatorBought,
    creatorSold,
    creatorHoldsPct: supply > 0 ? (held / supply) * 100 : 0,
    traders1h: traders1h.size,
    traders24h: traders24h.size,
    buyPressure1h,
    score,
  };
}

/** Listed on Memestock: a thesis, and a creator who bought and still holds most of it. */
export function isMemestock(description: string | undefined, signals: MemestockSignals): boolean {
  return (
    hasThesis(description) &&
    signals.creatorBought > 0 &&
    signals.creatorSold <= signals.creatorBought * MAX_CREATOR_SOLD_SHARE
  );
}
