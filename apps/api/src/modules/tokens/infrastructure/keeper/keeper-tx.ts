import type { PublicClient, WalletClient } from 'viem';

/** Headroom on a keeper transaction's gas estimate, in percent. */
const GAS_HEADROOM = 25n;

/**
 * Sends a keeper transaction (a request from simulateContract) and waits for its inclusion, so
 * the keeper's next transaction never stacks behind it. `pending` when it is still unmined after
 * two minutes: the next cycle's nonce check waits for it, or replaces it.
 *
 * Its gas is the estimate plus 25%: fills of large orders sent at their exact estimate ran out of
 * gas and reverted, and the keeper still paid for them.
 */
export async function sendAndWait(
  publicClient: PublicClient,
  walletClient: WalletClient,
  // The `request` simulateContract returned; viem types it per contract call.
  request: object,
): Promise<{ txHash: `0x${string}`; pending: boolean; reverted: boolean }> {
  // Without an estimate the wallet estimates itself, as before.
  const estimate = await publicClient.estimateContractGas?.(request as never).catch(() => null);
  const txHash = await walletClient.writeContract({
    ...(request as object),
    ...(estimate ? { gas: (estimate * (100n + GAS_HEADROOM)) / 100n } : {}),
  } as never);
  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 120_000,
    });
    return { txHash, pending: false, reverted: receipt.status === 'reverted' };
  } catch {
    return { txHash, pending: true, reverted: false };
  }
}

/**
 * The result fields of a sent keeper transaction. A reverted one did nothing: it was reported as
 * executed before, so a fill that ran out of gas showed in the logs as filled.
 */
export function sentResult(sent: { txHash: `0x${string}`; pending: boolean; reverted: boolean }) {
  if (sent.reverted) return { executed: false as const, txHash: sent.txHash, reason: 'Reverted' };
  return {
    executed: true as const,
    txHash: sent.txHash,
    ...(sent.pending ? { reason: 'Receipt pending' } : {}),
  };
}
