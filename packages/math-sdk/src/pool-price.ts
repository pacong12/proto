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
