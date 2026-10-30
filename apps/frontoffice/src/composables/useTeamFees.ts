import {
  gotonFeeSplitterAbi,
  gotonTeamSplitterAbi,
  gotonTeamSplitterFactoryAbi,
  launchpadTokenAbi,
  resolveFeeSplitter,
  type NetworkConfig,
} from '@goton/shared-types';
import { getPublicClient, waitForReceiptWithFallback } from '@/lib/viem-client';
import { requireConnectedWallet, sendWalletTransaction } from '@/lib/wallet-tx';
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
  const { walletClient: wallet, account } = await requireConnectedWallet(network);
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

export interface TeamAsset {
  address: `0x${string}`;
  symbol: string;
  decimals: number;
}

/** A team splitter behind a token: what each member is owed, per asset. */
export interface TeamPayouts {
  address: `0x${string}`;
  assets: TeamAsset[];
  members: Array<{ address: `0x${string}`; shareBps: number; due: bigint[] }>;
}

const NATIVE = '0x0000000000000000000000000000000000000000' as const;

/**
 * The token's tax recipient and its fee splitter's creator payout are where a team splitter can
 * sit; the first of them that answers `payees()` is the team.
 */
export async function readTeamPayouts(
  network: NetworkConfig,
  token: `0x${string}`,
  symbol: string,
): Promise<TeamPayouts | null> {
  const client = getPublicClient(network.chainId);
  const candidates = new Set<`0x${string}`>();
  let quote: `0x${string}` = NATIVE;
  try {
    const [, , recipient] = await client.readContract({
      address: token,
      abi: launchpadTokenAbi,
      functionName: 'taxConfig',
    });
    candidates.add(recipient);
  } catch {
    // Tokens without a tax config.
  }
  try {
    const splitter = await resolveFeeSplitter(client, network, token);
    if (splitter) {
      quote = (await client.readContract({
        address: splitter.address,
        abi: gotonFeeSplitterAbi,
        functionName: 'quoteAsset',
      })) as `0x${string}`;
      candidates.add(
        (await client.readContract({
          address: splitter.address,
          abi: gotonFeeSplitterAbi,
          functionName: 'creatorRecipient',
        })) as `0x${string}`,
      );
    }
  } catch {
    // No fee splitter yet (Robinhood before graduation).
  }

  for (const candidate of candidates) {
    try {
      const payees = (await client.readContract({
        address: candidate,
        abi: gotonTeamSplitterAbi,
        functionName: 'payees',
      })) as `0x${string}`[];
      const assets: TeamAsset[] = [
        { address: token, symbol, decimals: 18 },
        // The quote is native ETH, or the pool's quote ERC-20 (USDC on Arc).
        {
          address: quote,
          symbol: network.nativeCurrency.symbol,
          decimals: quote === NATIVE ? network.nativeCurrency.decimals : network.quoteTokenDecimals,
        },
      ];
      const members = await Promise.all(
        payees.map(async (address) => {
          const shareBps = Number(
            await client.readContract({
              address: candidate,
              abi: gotonTeamSplitterAbi,
              functionName: 'shareBps',
              args: [address],
            }),
          );
          const due = await Promise.all(
            assets.map(
              (a) =>
                client.readContract({
                  address: candidate,
                  abi: gotonTeamSplitterAbi,
                  functionName: 'releasable',
                  args: [a.address, address],
                }) as Promise<bigint>,
            ),
          );
          return { address, shareBps, due };
        }),
      );
      return { address: candidate, assets, members };
    } catch {
      // Not a team splitter.
    }
  }
  return null;
}

/** Pays every member their share of `asset` from the team splitter. */
export function releaseTeamAsset(
  network: NetworkConfig,
  team: `0x${string}`,
  asset: `0x${string}`,
): Promise<`0x${string}`> {
  return sendWalletTransaction(network, ({ walletClient, account }) =>
    walletClient.writeContract({
      address: team,
      abi: gotonTeamSplitterAbi,
      functionName: 'releaseAll',
      args: [asset],
      account,
      chain: walletClient.chain,
    }),
  );
}
