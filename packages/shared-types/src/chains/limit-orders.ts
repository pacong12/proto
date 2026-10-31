import { isDeployed, type NetworkConfig } from './types';

/** Every GotonLimitOrders deployment of a network that may hold orders: the current one first. */
export function limitOrderContracts(network: NetworkConfig): `0x${string}`[] {
  const all = [
    network.contracts.limitOrders,
    ...[...(network.contracts.limitOrdersPrevious ?? [])].reverse(),
  ];
  const seen = new Set<string>();
  return all.filter((a): a is `0x${string}` => {
    if (!isDeployed(a) || seen.has(a.toLowerCase())) return false;
    seen.add(a.toLowerCase());
    return true;
  });
}

/**
 * The network's first deployment, which held every order indexed before orders recorded their
 * contract (those rows have none).
 */
export function originalLimitOrders(network: NetworkConfig): `0x${string}` | null {
  const all = limitOrderContracts(network);
  return all[all.length - 1] ?? null;
}

/** The contract an indexed order lives in. */
export function limitOrderContractOf(
  network: NetworkConfig,
  order: { contract?: `0x${string}` },
): `0x${string}` | null {
  return order.contract ?? originalLimitOrders(network);
}

/** Order ids restart at 1 in every deployment, so the key names the contract too. */
export function limitOrderKey(chainId: number, contract: string, orderId: bigint | string): string {
  return `${chainId}-${contract.toLowerCase()}-${orderId}`;
}
