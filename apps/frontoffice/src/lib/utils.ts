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
