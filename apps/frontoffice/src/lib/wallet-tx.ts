import { erc20Abi, type PublicClient, type WalletClient } from 'viem';
import type { Ref } from 'vue';
import type { NetworkConfig } from '@goton/shared-types';
import { getPublicClient, getWalletClient, waitForReceiptWithFallback } from './viem-client';

export interface ConnectedWallet {
  walletClient: WalletClient;
  account: `0x${string}`;
}

/**
 * True when the error comes from the user rejecting the request in their wallet (EIP-1193 code
 * 4001, or the equivalent messages of MetaMask, WalletConnect, OKX, Bitget and Coinbase Wallet).
 */
export function isUserRejection(err: unknown): boolean {
  const msg = ((err as Error)?.message ?? '').toLowerCase();
  const code = (err as { code?: number })?.code;
  return (
    code === 4001 ||
    msg.includes('user reject') ||
    msg.includes('user denied') ||
    msg.includes('user cancelled') ||
    msg.includes('user canceled') ||
    msg.includes('action_rejected') ||
    msg.includes('rejected the request') ||
    msg.includes('rejected by user') ||
    msg.includes('transaction was rejected') ||
    msg.includes('request rejected')
  );
}

/**
 * The connected wallet and its account. With `network`, the wallet must already be on it
 * (FO-07: a transaction is never sent on whatever chain the wallet happens to be on).
 */
export async function requireConnectedWallet(network?: NetworkConfig): Promise<ConnectedWallet> {
  const walletClient = await getWalletClient();
  if (!walletClient) throw new Error('Connect your wallet first');
  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error('Connect your wallet first');
  if (network && (await walletClient.getChainId()) !== network.chainId) {
    throw new Error(`Switch your wallet to ${network.name} and retry.`);
  }
  return { walletClient, account };
}

/**
 * Sends one transaction from the connected wallet on `network` and waits until it is mined.
 * Throws when the wallet is missing or on another chain, and when the transaction reverts.
 */
export async function sendWalletTransaction(
  network: NetworkConfig,
  send: (wallet: ConnectedWallet) => Promise<`0x${string}`>,
): Promise<`0x${string}`> {
  const wallet = await requireConnectedWallet(network);
  const hash = await send(wallet);
  const receipt = await waitForReceiptWithFallback(
    getPublicClient(network.chainId),
    hash,
    wallet.walletClient,
  );
  if (receipt?.status === 'reverted') throw new Error(`Transaction reverted: ${hash}`);
  return hash;
}

/**
 * Approves exactly `amount` of `token` to `spender` when the allowance falls short, and waits for
 * the approval: the next transaction's gas estimate reads the allowance.
 */
export async function ensureAllowance(params: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: `0x${string}`;
  token: `0x${string}`;
  spender: `0x${string}`;
  amount: bigint;
  onSubmitted?: (hash: `0x${string}`) => void;
}): Promise<void> {
  const { publicClient, walletClient, account, token, spender, amount } = params;
  const allowance = await publicClient
    .readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [account, spender],
    })
    .catch(() => 0n);
  if (allowance >= amount) return;
  const hash = await walletClient.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, amount],
    account,
    chain: walletClient.chain,
  });
  params.onSubmitted?.(hash);
  await waitForReceiptWithFallback(publicClient, hash, walletClient);
}

/**
 * Runs a wallet action for a composable: sets `busy` while it runs and reports its error in
 * `error`, except a rejection in the wallet, which is the user's choice. Null when it failed.
 */
export async function runWalletAction<T>(
  state: { busy: Ref<boolean>; error: Ref<string | null> },
  action: () => Promise<T>,
): Promise<T | null> {
  state.busy.value = true;
  state.error.value = null;
  try {
    return await action();
  } catch (err) {
    if (!isUserRejection(err)) state.error.value = (err as Error).message;
    return null;
  } finally {
    state.busy.value = false;
  }
}
