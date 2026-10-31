import { encodeAbiParameters, keccak256, parseAbi, toHex, type Hex, type PublicClient } from 'viem';
import { bondingCurveAbi, gotonV4HookAbi, type V4PoolKey } from '@goton/contracts-abi';
import { isDeployed, type NetworkConfig } from './types';
import { protoV4PoolKeyFor } from './fee-splitter';

/** A v4 pool's id: keccak256 of its abi-encoded PoolKey. */
export function v4PoolId(key: V4PoolKey): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'address' },
        { type: 'uint24' },
        { type: 'int24' },
        { type: 'address' },
      ],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
    ),
  );
}

const extsloadAbi = parseAbi(['function extsload(bytes32 slot) view returns (bytes32)']);
/** PoolManager's `pools` mapping slot (v4-core StateLibrary.POOLS_SLOT). */
const POOLS_SLOT = 6n;

/**
 * A v4 pool's price and in-range liquidity, read from PoolManager storage (the layout v4-core's
 * StateLibrary reads): slot0 holds sqrtPriceX96 in its low 160 bits, liquidity sits 3 slots on.
 */
export async function readV4PoolState(
  client: PublicClient,
  poolManager: `0x${string}`,
  poolId: Hex,
): Promise<{ sqrtPriceX96: bigint; liquidity: bigint }> {
  const state = BigInt(
    keccak256(
      encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }], [poolId, POOLS_SLOT]),
    ),
  );
  const read = (slot: bigint) =>
    client.readContract({
      address: poolManager,
      abi: extsloadAbi,
      functionName: 'extsload',
      args: [toHex(slot, { size: 32 })],
    });
  const [slot0, liquidity] = await Promise.all([read(state), read(state + 3n)]);
  return {
    sqrtPriceX96: BigInt(slot0) & ((1n << 160n) - 1n),
    liquidity: BigInt(liquidity) & ((1n << 128n) - 1n),
  };
}

/** Whether stop-loss orders on a token can fire yet. */
export interface StopOracleStatus {
  /** The time-weighted price stops trigger on has its full history. */
  ready: boolean;
  /** Minimum history it needs: 10 minutes on the bonding curve, 30 in the v4 pool. */
  periodSeconds: number;
  /** When it should be ready (ms), or null until the first trade starts its history. */
  readyAt: number | null;
}

const CURVE_ORACLE_PERIOD_S = 600;
const POOL_ORACLE_PERIOD_S = 1800;

/**
 * Stop-losses trigger on a time-weighted price (the curve's, then the v4 hook's), which needs a
 * full period of trading history first. Its window rolls on the first trade after the period, so
 * `readyAt` is the earliest it can be ready.
 */
export async function stopLossOracleStatus(
  client: PublicClient,
  network: NetworkConfig,
  token: { address: `0x${string}`; curveAddress?: `0x${string}`; isGraduated?: boolean },
): Promise<StopOracleStatus | null> {
  const onCurve = !token.isGraduated && token.curveAddress && isDeployed(token.curveAddress);
  let olderTimestamp: number;
  let newerTimestamp: number;
  let periodSeconds: number;
  if (onCurve) {
    const o = (await client.readContract({
      address: token.curveAddress!,
      abi: bondingCurveAbi,
      functionName: 'oracle',
    })) as readonly (bigint | number)[];
    [olderTimestamp, newerTimestamp] = [Number(o[3]), Number(o[5])];
    periodSeconds = CURVE_ORACLE_PERIOD_S;
  } else {
    const key = protoV4PoolKeyFor(network, token.address);
    if (!key) return null;
    const o = (await client.readContract({
      address: key.hooks,
      abi: gotonV4HookAbi,
      functionName: 'oracles',
      args: [v4PoolId(key)],
    })) as readonly (bigint | number)[];
    [olderTimestamp, newerTimestamp] = [Number(o[3]), Number(o[5])];
    periodSeconds = POOL_ORACLE_PERIOD_S;
  }
  return {
    ready: olderTimestamp > 0,
    periodSeconds,
    readyAt:
      olderTimestamp > 0
        ? null
        : newerTimestamp > 0
          ? (newerTimestamp + periodSeconds) * 1000
          : null,
  };
}
