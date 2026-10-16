import { erc20Abi, type PublicClient } from 'viem';
import {
  getChainAbis,
  launchpadV2FactoryArcAbi,
  protoFeeSplitterAbi,
  protoV4GraduatorAbi,
} from '@proto/contracts-abi';
import { protoV4PoolKey, type V4PoolKey } from '@proto/contracts-abi';
import { UNDEPLOYED, type NetworkConfig } from './types';

export interface FeeSplitterInfo {
  address: `0x${string}`;
  /** Decimals of the quote currency fees and dividends are paid in (18 ETH, 6 USDC). */
  quoteDecimals: number;
}

function isDeployed(address?: string | null): address is `0x${string}` {
  return Boolean(address) && address!.toLowerCase() !== UNDEPLOYED;
}

/**
 * Locates a token's ProtoFeeSplitter. Bonding-curve chains create it at graduation
 * (ProtoV4Graduator.graduations); in-pool v4 chains create it at launch (factory.launches).
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
      abi: protoV4GraduatorAbi,
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
    abi: protoFeeSplitterAbi,
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
 * PoolKey of a token's Proto v4 pool. Bonding-curve chains (with a graduator) pair the token with
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
