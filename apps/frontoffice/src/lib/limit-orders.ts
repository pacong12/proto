/**
 * Order math for GotonLimitOrders. Targets are entered as market cap (USD), the unit memecoin
 * traders think in, and turned into the on-chain floors the contract enforces. Every floor is what
 * the owner actually receives, so the curve/pool fee, the token's tax and the 0.1% executor fee
 * are taken out first: an order fills when the market reaches the target, not later.
 */
import { constantProductSellAt } from '@goton/math-sdk';
import type { NetworkConfig } from '@goton/shared-types';

export const EXECUTOR_FEE_BPS = 10;
/** Bonding-curve trade fee and v4 pool LP fee. */
export const VENUE_FEE_BPS = 100;

export interface PriceContext {
  /** Current token price in quote units (e.g. ETH per token). */
  priceInQuote: number;
  /** Current token price in USD. */
  priceUsd: number;
  /** Total supply in whole tokens. */
  supply: number;
  quoteDecimals: number;
  tokenDecimals: number;
}

/** USD market cap -> token price in quote units, using the current quote/USD rate. */
export function priceAtMarketCap(marketCapUsd: number, ctx: PriceContext): number {
  if (!(marketCapUsd > 0) || !(ctx.supply > 0) || !(ctx.priceUsd > 0) || !(ctx.priceInQuote > 0))
    return 0;
  const quoteUsd = ctx.priceUsd / ctx.priceInQuote;
  return marketCapUsd / ctx.supply / quoteUsd;
}

/**
 * x * 10^digits as a bigint, rounded down, without losing precision on values far beyond 2^53
 * (e.g. 1e-9 ETH per token scaled by 1e36).
 */
export function toScaled(x: number, digits: number): bigint {
  if (!(x > 0) || !Number.isFinite(x)) return 0n;
  const [mantissa, exp] = x.toExponential(15).split('e');
  const [int, frac = ''] = mantissa.split('.');
  const digitsStr = int + frac; // mantissa * 10^frac.length
  const shift = Number(exp) - frac.length + digits;
  if (shift >= 0) return BigInt(digitsStr) * 10n ** BigInt(shift);
  const cut = digitsStr.length + shift;
  return cut > 0 ? BigInt(digitsStr.slice(0, cut)) : 0n;
}

const keep = (bps: number) => Math.max(0, 1 - bps / 10_000);

/** Limit buy: tokens (raw) received for `quoteIn` (whole quote units) at `price`, after costs. */
export function buyMinOut(
  quoteIn: number,
  price: number,
  buyTaxBps: number,
  ctx: PriceContext,
): bigint {
  if (!(price > 0)) return 0n;
  const tokens =
    ((quoteIn * keep(EXECUTOR_FEE_BPS)) / price) * keep(VENUE_FEE_BPS) * keep(buyTaxBps);
  return toScaled(tokens, ctx.tokenDecimals);
}

/** Sell leg: quote (raw) received for `tokens` (whole) at `price`, after costs and slippage. */
export function sellMinOut(
  tokens: number,
  price: number,
  sellTaxBps: number,
  ctx: PriceContext,
  slippageBps = 0,
): bigint {
  const quote = tokens * price * keep(VENUE_FEE_BPS) * keep(sellTaxBps) * keep(slippageBps);
  // The executor fee is taken from the output after the floor check, so it is not deducted here.
  return toScaled(quote, ctx.quoteDecimals);
}

/**
 * Sell leg floor with price impact: what selling all `tokens` (whole) pays once the spot price is
 * `price`, moving along a constant-product market with invariant `k` (raw units: curve reserves,
 * or a v4 pool's in-range liquidity squared), after the venue fee, the sell tax and
 * `toleranceBps`. Floors of tokens × price never filled for positions large against the market:
 * selling them moves the price, so the sale pays less. Without `k` that is the floor used.
 * `impact` is the share of tokens × price lost to it (0 to 1).
 */
export function sellFloor(
  tokens: number,
  price: number,
  sellTaxBps: number,
  ctx: PriceContext,
  k: number | null,
  toleranceBps = 0,
): { floor: bigint; impact: number } {
  if (!k || !(price > 0) || !(tokens > 0)) {
    return {
      floor: price > 0 ? sellMinOut(tokens, price, sellTaxBps, ctx, toleranceBps) : 0n,
      impact: 0,
    };
  }
  const atSpot = tokens * price * keep(VENUE_FEE_BPS) * keep(sellTaxBps);
  const raw = constantProductSellAt(
    k,
    price * 10 ** (ctx.quoteDecimals - ctx.tokenDecimals),
    tokens * 10 ** ctx.tokenDecimals,
    VENUE_FEE_BPS,
  );
  const quote = (raw / 10 ** ctx.quoteDecimals) * keep(sellTaxBps);
  return {
    floor: toScaled(quote * keep(toleranceBps), ctx.quoteDecimals),
    impact: atSpot > 0 ? Math.max(0, 1 - quote / atSpot) : 0,
  };
}

/** Stop-loss trigger in the contract's unit: quote raw per token raw, times 1e36. */
export function stopPriceX36(price: number, ctx: PriceContext): bigint {
  return toScaled(price, 36 + ctx.quoteDecimals - ctx.tokenDecimals);
}

/** Raw amount to a short decimal string (up to 6 significant digits). */
export function formatRawAmount(raw: string | bigint | undefined, decimals: number): string {
  if (raw === undefined || raw === null || raw === '') return '0';
  const n = BigInt(raw);
  const unit = 10n ** BigInt(decimals);
  const value = Number(n / unit) + Number(n % unit) / Number(unit);
  return value.toLocaleString(undefined, { maximumSignificantDigits: 6 });
}

/**
 * What a closed order paid out: tokens for a filled buy, the quote asset for a filled sell.
 * Null when the order did not fill.
 */
export function orderPayout(
  order: { isBuy: boolean; status: string; amountOut?: string },
  tokenSymbol: string,
  network: NetworkConfig,
): string | null {
  if (order.status !== 'filled' || !order.amountOut) return null;
  return order.isBuy
    ? `${formatRawAmount(order.amountOut, 18)} ${tokenSymbol}`
    : `${formatRawAmount(order.amountOut, network.quoteTokenDecimals)} ${network.nativeCurrency.symbol}`;
}
