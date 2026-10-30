import type { Address, PublicClient } from 'viem';
import { bondingCurveAbi, launchpadTokenAbi, launchpadV2FactoryAbi } from '../abis/contracts';
import type { LaunchedTokenEntity, TokenSocials, TokenTaxConfig } from '../domain/token';
import { UNDEPLOYED, isDeployed, type NetworkConfig } from './types';

/**
 * On-chain reads shared by the API indexer and the app, so both build a token the same way.
 */

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  logo: string;
  description: string;
  socials: TokenSocials;
}

/** A launchpad token's ERC-20 fields and metadata; logo, description and socials may be absent. */
export async function readTokenMetadata(
  client: PublicClient,
  token: Address,
): Promise<TokenMetadata> {
  const read = <F extends 'logo' | 'description'>(functionName: F) =>
    client.readContract({ address: token, abi: launchpadTokenAbi, functionName }).catch(() => '');
  const [name, symbol, decimals, totalSupply, logo, description, socials] = await Promise.all([
    client.readContract({ address: token, abi: launchpadTokenAbi, functionName: 'name' }),
    client.readContract({ address: token, abi: launchpadTokenAbi, functionName: 'symbol' }),
    client.readContract({ address: token, abi: launchpadTokenAbi, functionName: 'decimals' }),
    client.readContract({ address: token, abi: launchpadTokenAbi, functionName: 'totalSupply' }),
    read('logo'),
    read('description'),
    client
      .readContract({ address: token, abi: launchpadTokenAbi, functionName: 'socials' })
      .catch(() => ['', '', '', '', ''] as const),
  ]);
  const [twitter, telegram, discord, website, farcaster] = socials;
  return {
    name,
    symbol,
    decimals,
    totalSupply,
    logo: logo || '',
    description: description || '',
    socials: { twitter, telegram, discord, website, farcaster },
  };
}

export interface CurveState {
  totalEthRaised: bigint;
  virtualEthReserve: bigint;
  virtualTokenReserve: bigint;
  graduationTarget: bigint;
  graduated: boolean;
}

/** A bonding curve's reserves and graduation state. */
export async function readCurveState(client: PublicClient, curve: Address): Promise<CurveState> {
  const read = <F extends keyof CurveState>(functionName: F) =>
    client.readContract({ address: curve, abi: bondingCurveAbi, functionName });
  const [totalEthRaised, virtualEthReserve, virtualTokenReserve, graduationTarget, graduated] =
    await Promise.all([
      read('totalEthRaised'),
      read('virtualEthReserve'),
      read('virtualTokenReserve'),
      read('graduationTarget'),
      read('graduated'),
    ]);
  return { totalEthRaised, virtualEthReserve, virtualTokenReserve, graduationTarget, graduated };
}

export interface FactoryLaunch {
  curve: Address;
  creator: Address;
  /** Launch time, unix seconds. */
  createdAt: bigint;
  graduated: boolean;
}

/** The token's launch record in the network's V2 factories, or null when none launched it. */
export async function findFactoryLaunch(
  client: PublicClient,
  network: NetworkConfig,
  token: Address,
): Promise<FactoryLaunch | null> {
  const factories = [
    ...new Set([network.contracts.factoryV2, network.contracts.factory].filter(isDeployed)),
  ];
  for (const factory of factories) {
    try {
      const [, curve, creator, createdAt, graduated] = await client.readContract({
        address: factory,
        abi: launchpadV2FactoryAbi,
        functionName: 'launches',
        args: [token],
      });
      if (isDeployed(curve)) return { curve, creator, createdAt, graduated };
    } catch {
      // Not this factory (or an older ABI): try the next one.
    }
  }
  return null;
}

/** The creator tax in force, else the one queued before the first trade; undefined when none. */
async function readTaxConfig(
  client: PublicClient,
  token: Address,
): Promise<TokenTaxConfig | undefined> {
  const [current, pending] = await Promise.all([
    client
      .readContract({ address: token, abi: launchpadTokenAbi, functionName: 'taxConfig' })
      .catch(() => [0, 0, UNDEPLOYED] as const),
    client
      .readContract({ address: token, abi: launchpadTokenAbi, functionName: 'pendingTaxConfig' })
      .catch(() => [0, 0, UNDEPLOYED, 0n] as const),
  ]);
  const buyTaxBps = Number(current[0]) || Number(pending[0]) || undefined;
  const sellTaxBps = Number(current[1]) || Number(pending[1]) || undefined;
  const taxRecipient = [current[2], pending[2]].find(isDeployed);
  return buyTaxBps !== undefined || sellTaxBps !== undefined || taxRecipient
    ? { buyTaxBps, sellTaxBps, taxRecipient }
    : undefined;
}

/** A token on a V2 bonding curve, built from its contracts. */
export async function readV2LaunchedToken(
  client: PublicClient,
  network: NetworkConfig,
  token: Address,
  curve: Address,
  createdAtMs = Date.now(),
): Promise<LaunchedTokenEntity> {
  const [metadata, state, creator, taxConfig] = await Promise.all([
    readTokenMetadata(client, token),
    readCurveState(client, curve),
    client.readContract({ address: curve, abi: bondingCurveAbi, functionName: 'creator' }),
    readTaxConfig(client, token),
  ]);
  return {
    address: token,
    ...metadata,
    totalSupply: metadata.totalSupply.toString(),
    taxConfig,
    deployer: creator,
    pairedToken: network.contracts.weth,
    poolAddress: curve,
    isToken0: false, // V2 bonding curve: N/A
    poolFee: network.launchConfig.poolFee,
    positionId: 0n,
    restrictionsEndBlock: 0n,
    launchBlock: 0n,
    createdAt: createdAtMs,
    initialBuyAmount: state.totalEthRaised.toString(),
    version: 'v2',
    curveAddress: curve,
    // Stored for pricing without more RPC calls.
    virtualEthReserve: state.virtualEthReserve.toString(),
    virtualTokenReserve: state.virtualTokenReserve.toString(),
    graduationTarget: state.graduationTarget.toString(),
    isGraduated: state.graduated,
  };
}
