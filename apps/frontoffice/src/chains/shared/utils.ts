import { parseEther, type Abi, type Address, type PublicClient } from 'viem';
export { isDeployed } from '@goton/shared-types';

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

/** Headroom on a swap's gas estimate, in percent. */
const SWAP_GAS_HEADROOM = 25n;

/**
 * The gas limit for a swap: its estimate plus 25%. Trades that land before it in the same block
 * move the pool (more ticks crossed, larger transfers) and can make it cost more than estimated;
 * without headroom it then runs out of gas and reverts, and the trader still pays for the gas.
 * Only the gas used is charged. Undefined when the estimate fails, so the wallet estimates (and
 * reports the revert) itself.
 */
export async function swapGasLimit(
  publicClient: PublicClient,
  request: {
    address: Address;
    abi: Abi;
    functionName: string;
    args: readonly unknown[];
    value?: bigint;
    account: Address;
  },
): Promise<bigint | undefined> {
  try {
    const estimate = await publicClient.estimateContractGas(
      request as Parameters<PublicClient['estimateContractGas']>[0],
    );
    return (estimate * (100n + SWAP_GAS_HEADROOM)) / 100n;
  } catch {
    return undefined;
  }
}
