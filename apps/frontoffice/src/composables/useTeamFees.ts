import { gotonTeamSplitterFactoryAbi, type NetworkConfig } from '@goton/shared-types';
import { getPublicClient, getWalletClient, waitForReceiptWithFallback } from '@/lib/viem-client';
import { isDeployed } from '@/chains/shared/utils';

/** GotonTeamSplitterFactory on a network, or null where it is not deployed. */
export function teamFactoryAddress(network: NetworkConfig): `0x${string}` | null {
  const a = network.contracts.teamSplitterFactory;
  return isDeployed(a) ? a : null;
}

/**
 * Deploys a GotonTeamSplitter for `payees` / `sharesBps` and returns its address. The address is
 * read from a simulation of the same call, then the transaction is sent and confirmed.
 */
export async function createTeamSplitter(
  network: NetworkConfig,
  payees: `0x${string}`[],
  sharesBps: number[],
): Promise<`0x${string}`> {
  const factory = teamFactoryAddress(network);
  if (!factory) throw new Error(`Team payouts are not available on ${network.name} yet.`);
  const wallet = await getWalletClient();
  if (!wallet) throw new Error('Connect your wallet first');
  const [account] = await wallet.getAddresses();
  if ((await wallet.getChainId()) !== network.chainId) {
    throw new Error(`Switch your wallet to ${network.name} and retry.`);
  }
  const publicClient = getPublicClient(network.chainId);
  // A fresh salt per team, so the same members can form more than one team.
  const salt = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')}` as `0x${string}`;
  const args = [payees, sharesBps, salt] as const;
  const { result, request } = await publicClient.simulateContract({
    address: factory,
    abi: gotonTeamSplitterFactoryAbi,
    functionName: 'create',
    args,
    account,
  });
  const hash = await wallet.writeContract({ ...request, account, chain: wallet.chain });
  const receipt = await waitForReceiptWithFallback(publicClient, hash, wallet);
  if (receipt?.status !== 'success') throw new Error(`Creating the team wallet failed: ${hash}`);
  return result;
}
