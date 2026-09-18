import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  return `$${num.toFixed(8)}`;
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
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
