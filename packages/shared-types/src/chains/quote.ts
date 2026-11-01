import type { NetworkConfig } from './types';

const USD_STABLECOINS = new Set(['USDC', 'USDT', 'USDG', 'DAI']);

/** Stand-in ETH price for estimates while no live price is known. */
export const FALLBACK_ETH_PRICE_USD = 2500;

/** Whether a currency symbol is a USD stablecoin (priced at $1, shown with cents). */
export function isStableSymbol(symbol: string): boolean {
  return USD_STABLECOINS.has(symbol.toUpperCase());
}

/** The USD price of a network's quote currency when it is a stablecoin; null when it floats. */
export function stableQuoteUsd(cfg: NetworkConfig): number | null {
  return isStableSymbol(cfg.nativeCurrency.symbol) ? 1 : null;
}

/** Native wei per smallest unit of the quote token (10^12 for 18-decimal native USDC on Arc). */
export function nativeWeiPerQuoteUnit(cfg: NetworkConfig): bigint {
  return 10n ** BigInt(cfg.nativeCurrency.decimals - cfg.quoteTokenDecimals);
}
