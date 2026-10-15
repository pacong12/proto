export const MAX_TAX_PERCENT = 10; // Maximum allowed trading tax on Proto (10%)
export const MAX_TAX_BPS = 1000; // 1000 bps = 10%

/**
 * Converts a human-readable tax percentage (e.g. 5.5%) into integer basis points (550).
 * Clamps safely between 0 and 1000 bps (10%).
 */
export function taxPercentToBps(percent: number): number {
  if (isNaN(percent) || percent <= 0) return 0;
  return Math.min(MAX_TAX_BPS, Math.max(0, Math.round(percent * 100)));
}

/**
 * Converts integer basis points (e.g. 550) back to human-readable tax percentage (5.5%).
 */
export function taxBpsToPercent(bps: number): number {
  if (isNaN(bps) || bps <= 0) return 0;
  return Number((bps / 100).toFixed(2));
}

/**
 * Calculates net tokens received after deducting creator buy tax.
 */
export function calculateNetTokenAfterBuyTax(grossTokenOut: number, buyTaxPercent: number): number {
  if (grossTokenOut <= 0) return 0;
  const tax = Math.min(MAX_TAX_PERCENT, Math.max(0, buyTaxPercent));
  return grossTokenOut * (1 - tax / 100);
}

/**
 * Calculates net quote asset (ETH/USDC) received after deducting creator sell tax.
 */
export function calculateNetQuoteAfterSellTax(
  grossQuoteOut: number,
  sellTaxPercent: number,
): number {
  if (grossQuoteOut <= 0) return 0;
  const tax = Math.min(MAX_TAX_PERCENT, Math.max(0, sellTaxPercent));
  return grossQuoteOut * (1 - tax / 100);
}

/**
 * Calculates total cost due at token launch: platform creation fee + optional initial developer buy.
 */
export function calculateLaunchTotalDue(
  platformLaunchFee: number,
  initialBuyAmount: number,
): number {
  const fee = Math.max(0, platformLaunchFee || 0);
  const buy = Math.max(0, initialBuyAmount || 0);
  return fee + buy;
}
