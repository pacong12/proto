import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { isStableSymbol } from '@goton/shared-types';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Truncate a hex address to a human-friendly format (e.g. 0x1234...5678).
 */
export function shortenAddress(address?: string | null, start = 6, end = 4): string {
  if (!address) return '';
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

/**
 * Format an ETH value from wei (bigint) or number with a specified decimal precision.
 */
export function formatEth(value: bigint | number | string, decimals = 4): string {
  const num = typeof value === 'bigint' ? Number(value) / 1e18 : Number(value);
  if (isNaN(num)) return '0';
  return num.toFixed(decimals);
}

/**
 * A native quote balance (18-decimal wei): cents for a stablecoin quote, more digits for ETH.
 */
export function formatQuoteBalance(wei: bigint, symbol: string): string {
  const val = Number(wei) / 1e18;
  if (isStableSymbol(symbol)) {
    if (val === 0) return '0.00';
    return val < 0.01 ? val.toFixed(4) : val.toFixed(2);
  }
  if (val === 0) return '0.0000';
  return val < 0.0001 ? val.toFixed(6) : val.toFixed(4);
}

/**
 * A token balance in its own decimals, compact from a thousand up.
 */
export function formatTokenBalance(raw: bigint, decimals = 18): string {
  const val = Number(raw) / 10 ** decimals;
  if (val === 0) return '0.00';
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(2)}K`;
  if (val >= 1) return val.toFixed(2);
  if (val >= 0.0001) return val.toFixed(4);
  return val.toFixed(6);
}

/**
 * Format a number as a USD currency string.
 */
export function formatUsd(value: number): string {
  if (isNaN(value) || value === 0) return '$0.00';
  if (value < 0.01) return `$${value.toFixed(6)}`;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format a number as a compact USD currency string (e.g. $1.25K, $50.40M, $1.20B, $2.46T).
 * Guarantees values never overflow table cells with long number strings.
 */
export function formatCompactUsd(value: number | string | undefined | null): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (isNaN(num) || num <= 0) return '$0';
  if (num >= 1_000_000_000_000) return `$${(num / 1_000_000_000_000).toFixed(2)}T`;
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
  if (num >= 1) return `$${num.toFixed(2)}`;
  if (num >= 0.01) return `$${num.toFixed(3)}`;
  return `$${num.toFixed(4)}`;
}

/**
 * Market cap for display. Unknown or zero shows a dash instead of an invented figure.
 */
export function formatMarketCap(value: number | string | undefined | null): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  return Number.isFinite(num) && num > 0 ? formatCompactUsd(num) : '—';
}

/**
 * Format token spot price in USD cleanly without visual overflow.
 */
export function formatPriceUsd(price: number | string | undefined | null): string {
  const num = typeof price === 'string' ? parseFloat(price) : (price ?? 0);
  if (isNaN(num) || num <= 0) return '$0.00';
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
  if (num >= 1) return `$${num.toFixed(2)}`;
  if (num >= 0.01) return `$${num.toFixed(4)}`;
  if (num >= 0.0001) return `$${num.toFixed(6)}`;
  if (num >= 0.00000001) return `$${num.toFixed(8)}`;
  return `$${num.toFixed(11)}`;
}

const SUB_DIGITS = '₀₁₂₃₄₅₆₇₈₉';
export function toSubscript(num: number): string {
  return String(num).replace(/\d/g, (d) => SUB_DIGITS[Number(d)]);
}

/**
 * Format small token spot price in clean DEX subscript notation (e.g. 0.0₆1234).
 */
export function formatSubscriptPrice(v: number): string {
  if (!isFinite(v) || v === 0) return '0';
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (v >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (v >= 0.0001) return v.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  const [mantissa, exponent] = v.toExponential(3).split('e');
  const zeros = Math.abs(Number(exponent)) - 1;
  const sig = mantissa.replace('.', '').replace(/0+$/, '');
  return `0.0${toSubscript(zeros)}${sig}`;
}

/**
 * Format token quantities compactly (e.g. 1.25M, 450.00K).
 */
export function formatTokenNumber(raw: string | number): string {
  const num = typeof raw === 'string' ? parseFloat(raw) : raw;
  if (isNaN(num)) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Format a past timestamp into a relative time description (e.g. 10s ago, 5m ago).
 */
export function formatRelativeTime(timestamp: number): string {
  // Unknown (0) shows a dash; values in seconds are accepted as well as milliseconds.
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '—';
  const ms = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const diffSec = Math.floor((Date.now() - ms) / 1000);
  if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export {
  getChainIcon,
  getChainName,
  getChainShortName,
  getTokenChainIcon,
  getTokenChainName,
} from './chain-utils';
