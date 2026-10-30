import type { PublicClient, WalletClient } from 'viem';

/**
 * Sends a keeper transaction (a request from simulateContract) and waits for its inclusion, so
 * the keeper's next transaction never stacks behind it. `pending` when it is still unmined after
 * two minutes: the next cycle's nonce check waits for it, or replaces it.
 */
export async function sendAndWait(
  publicClient: PublicClient,
  walletClient: WalletClient,
  // The `request` simulateContract returned; viem types it per contract call.
  request: object,
): Promise<{ txHash: `0x${string}`; pending: boolean }> {
  const txHash = await walletClient.writeContract(request as never);
  try {
    await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
    return { txHash, pending: false };
  } catch {
    return { txHash, pending: true };
  }
}

/** The result fields of a sent keeper transaction. */
export function sentResult(sent: { txHash: `0x${string}`; pending: boolean }) {
  return {
    executed: true as const,
    txHash: sent.txHash,
    ...(sent.pending ? { reason: 'Receipt pending' } : {}),
  };
}
