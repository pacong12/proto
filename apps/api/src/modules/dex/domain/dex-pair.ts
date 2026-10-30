import { getAddress } from 'viem';
import type { LaunchedTokenEntity } from '@goton/shared-types';

/** Pair and asset ids as DEX Screener sees them (see presentation/dex-screener.presenter.ts). */

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const POOL_ID = /^0x[a-fA-F0-9]{64}$/;

/** A pair id as DEX Screener sees it: a checksummed curve address or a lowercase v4 poolId. */
export function parsePairId(id: string): string | null {
  if (ADDRESS.test(id)) return getAddress(id);
  if (POOL_ID.test(id)) return id.toLowerCase();
  return null;
}

/** A checksummed asset id (token or quote contract address), or null for anything else. */
export function parseAssetId(id: string): `0x${string}` | null {
  return ADDRESS.test(id) ? getAddress(id) : null;
}

/** Whether `pairId` is the token's bonding curve rather than its v4 pool. */
export function isCurvePair(token: LaunchedTokenEntity, pairId: string): boolean {
  return !!token.curveAddress && token.curveAddress.toLowerCase() === pairId.toLowerCase();
}

/** UNIX seconds; the indexer stores some timestamps in milliseconds. */
export function toUnixSeconds(timestamp: number): number {
  return timestamp > 1e12 ? Math.floor(timestamp / 1000) : Math.floor(timestamp);
}
