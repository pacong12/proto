import { formatUnits } from 'viem';

/**
 * Four decimals, except that a tiny balance stays visible: 0.000023 must not read as 0.0000 and
 * switch off a claim button. Always a plain decimal, because callers pass it to Number().
 */
export function formatDividendAmount(wei: bigint, decimals: number): string {
  const value = Number(formatUnits(wei, decimals));
  return value > 0 && value < 0.0001
    ? value.toLocaleString('en-US', { maximumSignificantDigits: 2, useGrouping: false })
    : value.toFixed(4);
}

export interface CurrencyAmount {
  symbol: string;
  raw: bigint;
  decimals: number;
}

/**
 * One line per currency with a balance, e.g. ["0.0120 ETH", "4.5000 USDC"]: tokens quote in their
 * own chain's currency, so these amounts can never be added together. With no balance at all, a
 * single zero in `fallbackSymbol`.
 */
export function totalsByCurrency(
  rows: readonly CurrencyAmount[],
  fallbackSymbol: string,
): string[] {
  const totals = new Map<string, CurrencyAmount>();
  for (const row of rows) {
    if (row.raw <= 0n) continue;
    const key = `${row.symbol}:${row.decimals}`;
    const total = totals.get(key);
    totals.set(key, total ? { ...total, raw: total.raw + row.raw } : { ...row });
  }
  if (totals.size === 0) return [`${formatDividendAmount(0n, 18)} ${fallbackSymbol}`];
  return [...totals.values()].map(
    (total) => `${formatDividendAmount(total.raw, total.decimals)} ${total.symbol}`,
  );
}
