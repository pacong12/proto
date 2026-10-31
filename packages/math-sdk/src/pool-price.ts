/**
 * Quote asset per token from a Uniswap pool's sqrtPriceX96 (token1 per token0 in raw units,
 * squared, over 2^192), for the token on either side and with each side's decimals: 18 for the
 * launched token and ETH, 6 for USDC.
 */
export function sqrtPriceX96ToQuotePrice(
  sqrtPriceX96: bigint,
  tokenIsToken0: boolean,
  quoteDecimals: number,
  tokenDecimals = 18,
): number {
  const ratio = Number(sqrtPriceX96) / 2 ** 96;
  const rawToken1PerToken0 = ratio * ratio;
  if (!(rawToken1PerToken0 > 0) || !Number.isFinite(rawToken1PerToken0)) return 0;
  const rawQuotePerToken = tokenIsToken0 ? rawToken1PerToken0 : 1 / rawToken1PerToken0;
  return rawQuotePerToken * 10 ** (tokenDecimals - quoteDecimals);
}

/**
 * Quote received for selling `tokensIn` into a constant-product market with invariant `k` (quote
 * raw × token raw) whose spot price is `price` (quote raw per token raw), after an input fee.
 * Price impact included. A v4 pool's in-range liquidity L gives k = L²; a bonding curve's
 * virtual reserves give k = vEth × vToken.
 */
export function constantProductSellAt(
  k: number,
  price: number,
  tokensIn: number,
  feeBps: number,
): number {
  if (!(k > 0) || !(price > 0) || !(tokensIn > 0)) return 0;
  const quoteReserve = Math.sqrt(k * price);
  const tokenReserve = Math.sqrt(k / price);
  const net = tokensIn * (1 - feeBps / 10_000);
  return (quoteReserve * net) / (tokenReserve + net);
}

/**
 * The lowest spot price at which selling `tokensIn` all at once yields `quoteOut` (see
 * constantProductSellAt), or Infinity when no price does.
 */
export function priceForSellProceeds(
  k: number,
  tokensIn: number,
  quoteOut: number,
  feeBps: number,
): number {
  if (!(quoteOut > 0)) return 0;
  // Proceeds rise with the price; bracket the answer, then bisect.
  let lo = 0;
  let hi = quoteOut / tokensIn || 1e-30;
  for (let i = 0; i < 400 && constantProductSellAt(k, hi, tokensIn, feeBps) < quoteOut; i++)
    hi *= 2;
  if (constantProductSellAt(k, hi, tokensIn, feeBps) < quoteOut) return Infinity;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (constantProductSellAt(k, mid, tokensIn, feeBps) >= quoteOut) hi = mid;
    else lo = mid;
  }
  return hi;
}
