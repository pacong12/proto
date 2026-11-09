import { erc20Abi, type PublicClient } from 'viem';
import {
  getChainAbis,
  launchpadV2FactoryArcAbi,
  gotonFeeSplitterAbi,
  gotonV4GraduatorAbi,
  gotonV4HookAbi,
} from '@goton/contracts-abi';
import { protoV4PoolKey, type V4PoolKey } from '@goton/contracts-abi';
import { UNDEPLOYED, type NetworkConfig } from './types';
import { v4PoolId } from './v4-pool';

export interface FeeSplitterInfo {
  address: `0x${string}`;
  /** Decimals of the quote currency fees and dividends are paid in (18 ETH, 6 USDC). */
  quoteDecimals: number;
}

function isDeployed(address?: string | null): address is `0x${string}` {
  return Boolean(address) && address!.toLowerCase() !== UNDEPLOYED;
}

/**
 * Locates a token's GotonFeeSplitter. Bonding-curve chains create it at graduation
 * (GotonV4Graduator.graduations); in-pool v4 chains create it at launch (factory.launches).
 * Returns null when the token has no splitter yet (not graduated / legacy token).
 */
export async function resolveFeeSplitter(
  client: PublicClient,
  network: NetworkConfig,
  token: `0x${string}`,
): Promise<FeeSplitterInfo | null> {
  let splitter: `0x${string}` | undefined;

  if (getChainAbis(network.chainId).graduator) {
    if (!isDeployed(network.contracts.graduator)) return null;
    const [address] = await client.readContract({
      address: network.contracts.graduator,
      abi: gotonV4GraduatorAbi,
      functionName: 'graduations',
      args: [token],
    });
    splitter = address;
  } else {
    const factory = network.contracts.factoryV2 ?? network.contracts.factory;
    if (!isDeployed(factory)) return null;
    const launch = await client.readContract({
      address: factory,
      abi: launchpadV2FactoryArcAbi,
      functionName: 'launches',
      args: [token],
    });
    splitter = launch[1];
  }

  if (!isDeployed(splitter)) return null;

  const quote = await client.readContract({
    address: splitter,
    abi: gotonFeeSplitterAbi,
    functionName: 'quoteAsset',
  });
  const quoteDecimals = isDeployed(quote)
    ? await client.readContract({ address: quote, abi: erc20Abi, functionName: 'decimals' })
    : network.nativeCurrency.decimals;

  return { address: splitter, quoteDecimals };
}

/** True when the network can host fee splitters (contracts that create them are deployed). */
export function supportsFeeSplitters(network: NetworkConfig): boolean {
  if (getChainAbis(network.chainId).graduator) return isDeployed(network.contracts.graduator);
  return isDeployed(network.contracts.factoryV2 ?? network.contracts.factory);
}

/**
 * PoolKey of a token's Goton v4 pool. Bonding-curve chains (with a graduator) pair the token with
 * native ETH; in-pool chains pair it with the chain's quote ERC-20 (`contracts.weth`, USDC on Arc).
 */
export function protoV4PoolKeyFor(network: NetworkConfig, token: `0x${string}`): V4PoolKey | null {
  const hook = network.contracts.memeHook;
  if (!isDeployed(hook)) return null;
  const quote = getChainAbis(network.chainId).graduator
    ? (UNDEPLOYED as `0x${string}`)
    : network.contracts.weth;
  return protoV4PoolKey(token, quote, hook);
}

/** Basis points of GotonFeeSplitter's split. */
const SPLIT_BPS = 10_000n;

export interface CreatorFees extends FeeSplitterInfo {
  /** The creator's share already in the splitter: claimCreatorFees pays it now. */
  accrued: bigint;
  /**
   * The creator's share of fees not collected into the splitter yet: the pool's LP fees
   * (collectFees) and swap tax a v2 hook holds (flushTaxes). Anyone can collect them; the keeper
   * does when they are worth its gas, so until then accrued alone read 0.
   */
  pending: bigint;
  /** What collecting needs: the LP fees to collect, the hook tax to flush (quote units). */
  uncollectedLpFees: bigint;
  uncollectedTax: bigint;
  /** Where the creator share is paid, and the creator (both may claim). */
  recipient: `0x${string}`;
  creator: `0x${string}`;
}

/**
 * A token's creator fees: claimable now, and the share of fees still waiting to be collected,
 * split as the splitter will (protocol first, then the creator's part of the rest). Null when the
 * token has no splitter yet (a bonding curve before graduation pays no creator fee to claim).
 */
export async function readCreatorFees(
  client: PublicClient,
  network: NetworkConfig,
  token: `0x${string}`,
): Promise<CreatorFees | null> {
  const splitter = await resolveFeeSplitter(client, network, token);
  if (!splitter) return null;
  const read = <T>(functionName: string) =>
    client.readContract({
      address: splitter.address,
      abi: gotonFeeSplitterAbi,
      functionName: functionName as never,
    }) as Promise<T>;
  const [accrued, protocolBps, creatorBps, recipient, creator, uncollectedLpFees, uncollectedTax] =
    await Promise.all([
      read<bigint>('creatorAccrued'),
      read<number>('protocolBps'),
      read<number>('creatorBps'),
      read<`0x${string}`>('creatorRecipient'),
      read<`0x${string}`>('creator'),
      uncollectedPoolFees(client, network, token),
      uncollectedHookTax(client, network, token),
    ]);
  const uncollected = uncollectedLpFees + uncollectedTax;
  const rest = uncollected - (uncollected * BigInt(protocolBps)) / SPLIT_BPS;
  return {
    ...splitter,
    accrued,
    pending: (rest * BigInt(creatorBps)) / SPLIT_BPS,
    uncollectedLpFees,
    uncollectedTax,
    recipient,
    creator,
  };
}

/** The contract holding a token's locked LP position: the graduator, or the Arc factory. */
export function feeCollector(network: NetworkConfig): {
  address: `0x${string}`;
  abi: typeof gotonV4GraduatorAbi | typeof launchpadV2FactoryArcAbi;
} | null {
  const graduated = Boolean(getChainAbis(network.chainId).graduator);
  const address = graduated
    ? network.contracts.graduator
    : (network.contracts.factoryV2 ?? network.contracts.factory);
  if (!isDeployed(address)) return null;
  return { address, abi: graduated ? gotonV4GraduatorAbi : launchpadV2FactoryArcAbi };
}

/** Quote-side LP fees collectFees would collect now (simulated), 0 when it cannot. */
async function uncollectedPoolFees(
  client: PublicClient,
  network: NetworkConfig,
  token: `0x${string}`,
): Promise<bigint> {
  const collector = feeCollector(network);
  if (!collector) return 0n;
  try {
    const { result } = await client.simulateContract({
      address: collector.address,
      abi: collector.abi as typeof gotonV4GraduatorAbi,
      functionName: 'collectFees',
      args: [token],
    });
    return (result as readonly [bigint, bigint])[0];
  } catch {
    return 0n;
  }
}

/** Swap tax a v2 hook holds for the token's pool, 0 for the first hook (it pays tax at once). */
async function uncollectedHookTax(
  client: PublicClient,
  network: NetworkConfig,
  token: `0x${string}`,
): Promise<bigint> {
  const key = protoV4PoolKeyFor(network, token);
  if (!key) return 0n;
  try {
    return await client.readContract({
      address: key.hooks,
      abi: gotonV4HookAbi,
      functionName: 'pendingTax',
      args: [v4PoolId(key)],
    });
  } catch {
    return 0n;
  }
}
