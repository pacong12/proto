import type { NetworkConfig } from './types';

const USD_STABLECOINS = new Set(['USDC', 'USDT', 'USDG', 'DAI']);

/** The USD price of a network's quote currency when it is a stablecoin; null when it floats. */
export function stableQuoteUsd(cfg: NetworkConfig): number | null {
  return USD_STABLECOINS.has(cfg.nativeCurrency.symbol.toUpperCase()) ? 1 : null;
}

/** Native wei per smallest unit of the quote token (10^12 for 18-decimal native USDC on Arc). */
export function nativeWeiPerQuoteUnit(cfg: NetworkConfig): bigint {
  return 10n ** BigInt(cfg.nativeCurrency.decimals - cfg.quoteTokenDecimals);
}
