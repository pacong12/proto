import type { NetworkConfig } from '@goton/shared-types';

/** What a row of a token's holder list is: a person's wallet, or supply nobody can trade from. */
export type HolderKind = 'wallet' | 'curve' | 'pool' | 'locker' | 'burn' | 'contract';

export interface HolderContext {
  tokenAddress?: string;
  curveAddress?: string;
  /** The token's pool: a contract address, or the 66-character id of a v4 pool. */
  poolAddress?: string;
  /** The v4 PoolManager, which holds the tokens of every pool on the chain. */
  poolManagerAddress?: string;
  lockerAddress?: string;
  /** The chain's other protocol contracts (escrows, routers), see `networkProtocolAddresses`. */
  protocolAddresses?: readonly string[];
}

export interface HolderRow {
  address: string;
  percent: number;
  /** Raw token units, as the API lists them. */
  balance?: string;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const BURN_ADDRESSES = new Set([ZERO_ADDRESS, '0x000000000000000000000000000000000000dead']);
const WALLET_ADDRESS = /^0x[0-9a-f]{40}$/;

/** Every contract the network config names, without the unset ones. */
export function networkProtocolAddresses(network: NetworkConfig): string[] {
  return Object.values(network.contracts)
    .flat()
    .filter((address): address is `0x${string}` => Boolean(address) && address !== ZERO_ADDRESS)
    .map((address) => address.toLowerCase());
}

export function classifyHolder(address: string, context: HolderContext = {}): HolderKind {
  const lower = address.toLowerCase();
  const is = (other?: string) => Boolean(other) && other!.toLowerCase() === lower;
  if (BURN_ADDRESSES.has(lower)) return 'burn';
  if (is(context.curveAddress)) return 'curve';
  if (is(context.poolAddress) || is(context.poolManagerAddress)) return 'pool';
  // A v4 pool id is 32 bytes, so it reads as an over-long address.
  if (!WALLET_ADDRESS.test(lower)) return 'pool';
  if (is(context.lockerAddress)) return 'locker';
  if (is(context.tokenAddress)) return 'contract';
  if (context.protocolAddresses?.some(is)) return 'contract';
  return 'wallet';
}

/** Only the holders that are wallets, largest first. */
export function walletHolders<T extends HolderRow>(
  holders: readonly T[],
  context: HolderContext = {},
): T[] {
  return holders
    .filter((h) => classifyHolder(h.address, context) === 'wallet')
    .sort((a, b) => b.percent - a.percent);
}

/** Share of the total supply held by the 10 largest wallets. */
export function top10WalletPercent(holders: readonly HolderRow[], context: HolderContext = {}) {
  return walletHolders(holders, context)
    .slice(0, 10)
    .reduce((sum, h) => sum + h.percent, 0);
}

/** Share of the total supply in one wallet; a contract row is never a wallet's holding. */
export function walletPercent(
  holders: readonly HolderRow[],
  wallet: string | undefined,
  context: HolderContext = {},
): number {
  if (!wallet) return 0;
  const lower = wallet.toLowerCase();
  return (
    walletHolders(holders, context).find((h) => h.address.toLowerCase() === lower)?.percent ?? 0
  );
}

/** Tokens at the burn addresses (raw units): sent to 0xdEaD, so still in totalSupply on-chain. */
export function burnedRaw(holders: readonly HolderRow[]): bigint {
  return holders
    .filter((h) => classifyHolder(h.address) === 'burn')
    .reduce((sum, h) => {
      try {
        return sum + BigInt(h.balance ?? '0');
      } catch {
        return sum;
      }
    }, 0n);
}

/** Share of the total supply at the burn addresses. */
export function burnedPercent(holders: readonly HolderRow[]): number {
  return holders
    .filter((h) => classifyHolder(h.address) === 'burn')
    .reduce((sum, h) => sum + h.percent, 0);
}
