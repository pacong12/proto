import type { TokenHolder } from '@goton/shared-types';

export interface HolderPosition {
  /** Whole tokens held. */
  tokens: number;
  usd: number;
  /** Share of supply, 0 to 100. */
  supplyPercent: number;
}

/**
 * A caller's position from the indexed holder row. The row's balance is in raw token units
 * (`decimals` places), the way balances are indexed on chain.
 */
export function holderPosition(
  holder: Pick<TokenHolder, 'balance' | 'percent'>,
  decimals: number,
  priceUsd: number,
): HolderPosition | null {
  let raw: bigint;
  try {
    raw = BigInt(holder.balance);
  } catch {
    return null;
  }
  if (raw <= 0n) return null;
  const tokens = Number(raw) / 10 ** decimals;
  return {
    tokens,
    usd: tokens * (priceUsd > 0 ? priceUsd : 0),
    supplyPercent: Math.min(100, Math.max(0, holder.percent || 0)),
  };
}
