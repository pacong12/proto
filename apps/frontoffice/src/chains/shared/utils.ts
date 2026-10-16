import { parseEther } from 'viem';
import { UNDEPLOYED } from '@proto/shared-types';

export function isDeployed(address?: string | null): address is `0x${string}` {
  return Boolean(address) && address!.toLowerCase() !== UNDEPLOYED;
}

/**
 * Parses a user-entered quote amount (native units, 18 dp) to wei, keeping at most 6 decimals.
 * Accepts numbers too: form bindings sometimes hand over a number instead of a string.
 */
export function parseInitialBuyWei(raw?: string | number | null): bigint {
  if (raw === undefined || raw === null) return 0n;
  const clean = String(raw).trim();
  if (!clean || clean === '0') return 0n;
  const num = parseFloat(clean);
  if (!Number.isFinite(num) || num <= 0) return 0n;
  // 6 decimals keeps the value a whole number of Arc USDC ERC-20 units (1 unit = 1e12 wei).
  return parseEther(num.toFixed(6));
}

export function resolveMinAmountOut(
  explicitMin: bigint | undefined,
  expectedOut: bigint | undefined,
  slippagePercent: number,
): bigint {
  if (explicitMin !== undefined && explicitMin > 0n) return explicitMin;
  if (expectedOut && expectedOut > 0n) {
    const clampedSlippage = Math.min(Math.max(slippagePercent, 0), 49.0);
    const factor = BigInt(Math.floor((100 - clampedSlippage) * 100));
    return (expectedOut * factor) / 10_000n;
  }
  throw new Error('Swap output estimate unavailable. Please retry in a few seconds.');
}
