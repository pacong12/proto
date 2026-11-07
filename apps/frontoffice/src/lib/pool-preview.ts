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

const Q96 = 1n << 96n;
const keepRaw = (amount: bigint, bps: number) =>
  (amount * BigInt(10_000 - Math.min(10_000, Math.max(0, Math.round(bps))))) / 10_000n;

/**
 * Raw output of a pool swap from the pool's live sqrt price and in-range liquidity, after the LP
 * fee and the hook's tax: for when the router cannot simulate it (a sell not approved yet, no
 * wallet). It takes that liquidity to hold for the whole swap, so it is exact until the price
 * leaves the current range; past a graduation reserve's edge it is an estimate, still with the
 * price impact a spot figure leaves out. Null when the pool has no price or liquidity.
 */
export function poolOutputFromLiquidity(swap: {
  isBuy: boolean;
  amountInRaw: bigint;
  sqrtPriceX96: bigint;
  liquidity: bigint;
  quoteIsCurrency0: boolean;
  taxBps: number;
}): bigint | null {
  const { sqrtPriceX96: price, liquidity } = swap;
  if (price <= 0n || liquidity <= 0n || swap.amountInRaw <= 0n) return null;
  // The hook taxes a buy's quote before the swap, then the pool takes its fee from the input.
  const input = keepRaw(
    swap.isBuy ? keepRaw(swap.amountInRaw, swap.taxBps) : swap.amountInRaw,
    VENUE_FEE_BPS,
  );
  // A buy pays in quote, so its input is currency0 exactly when the quote is.
  let out: bigint;
  if (swap.isBuy === swap.quoteIsCurrency0) {
    const next = (liquidity * price * Q96) / (liquidity * Q96 + input * price);
    out = (liquidity * (price - next)) / Q96;
  } else {
    const next = price + (input * Q96) / liquidity;
    out = (liquidity * Q96 * (next - price)) / next / price;
  }
  // A sell's tax comes off the quote it receives.
  return swap.isBuy ? out : keepRaw(out, swap.taxBps);
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
