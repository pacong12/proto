/**
 * Preview math for a swap in a Goton v4 pool. The hook takes the pool's tax on the quote side (from
 * the input of a buy, from the output of a sell) and the pool its LP fee, so what the trader gets is
 * spot less both, then less price impact.
 */
import { parseAbi, type PublicClient } from 'viem';
import { protoV4PoolKeyFor, v4PoolId, type NetworkConfig } from '@goton/shared-types';
import { VENUE_FEE_BPS } from './limit-orders';

const keep = (bps: number) => Math.max(0, 1 - bps / 10_000);

/** Whole tokens (buy) or whole quote (sell) for `input` at spot `price`, before price impact. */
export function poolOutputAtSpot(
  input: number,
  price: number,
  isBuy: boolean,
  taxBps: number,
): number {
  if (!(input > 0) || !(price > 0)) return 0;
  return (isBuy ? input / price : input * price) * keep(VENUE_FEE_BPS) * keep(taxBps);
}

/**
 * Share of the spot output a swap loses to moving the price (0 to 1), from its simulated output and
 * the pool's live sqrt price, so a stale indexed price cannot show up as impact. Raw units.
 */
export function poolSwapImpact(swap: {
  isBuy: boolean;
  amountInRaw: bigint;
  amountOutRaw: bigint;
  sqrtPriceX96: bigint;
  quoteIsCurrency0: boolean;
  taxBps: number;
}): number | null {
  const sqrtPrice = Number(swap.sqrtPriceX96) / 2 ** 96;
  if (!(sqrtPrice > 0) || swap.amountInRaw <= 0n) return null;
  const currency1PerCurrency0 = sqrtPrice ** 2;
  const quotePerToken = swap.quoteIsCurrency0 ? 1 / currency1PerCurrency0 : currency1PerCurrency0;
  const atSpot = poolOutputAtSpot(Number(swap.amountInRaw), quotePerToken, swap.isBuy, swap.taxBps);
  return atSpot > 0 ? Math.max(0, 1 - Number(swap.amountOutRaw) / atSpot) : null;
}

/** Share of the output at the curve's spot price lost to moving the price (0 to 1). */
export function curveSwapImpact(output: number, spotOutput: number): number | null {
  return spotOutput > 0 ? Math.max(0, 1 - output / spotOutput) : null;
}

export function formatPriceImpact(impact: number | null | undefined): string {
  if (impact === null || impact === undefined) return '—';
  if (impact < 0.001) return '< 0.1%';
  return `${(impact * 100).toFixed(impact < 0.1 ? 2 : 1)}%`;
}

// Only the fields both hook versions share, in their order; viem ignores the rest of the struct.
const hookPoolsAbi = parseAbi([
  'function pools(bytes32) view returns (address token, address quote, address splitter, uint16 buyTaxBps, uint16 sellTaxBps)',
]);

/**
 * The fixed tax a token's pool charges. The hook holds it: an in-pool token's own tax config stays
 * at zero. Null when the token has no registered pool on this network. Not `currentTaxBps`, which
 * would report the anti-snipe tax of the first seconds for as long as the page stays open.
 */
export async function readPoolTaxBps(
  client: PublicClient,
  network: NetworkConfig,
  token: `0x${string}`,
): Promise<{ buyTaxBps: number; sellTaxBps: number } | null> {
  const key = protoV4PoolKeyFor(network, token);
  if (!key) return null;
  const pool = await client.readContract({
    address: key.hooks,
    abi: hookPoolsAbi,
    functionName: 'pools',
    args: [v4PoolId(key)],
  });
  if (BigInt(pool[0]) === 0n) return null;
  return { buyTaxBps: Number(pool[3]), sellTaxBps: Number(pool[4]) };
}
