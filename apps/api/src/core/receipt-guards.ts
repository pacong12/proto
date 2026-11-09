/**
 * Guards for transaction receipts named by a public request (POST /api/tokens/:address/sync).
 * Any contract can emit an event with the same signature as ours, so a log only counts when it
 * comes from the contract that is supposed to emit it.
 */

interface ReceiptLog {
  address: string;
  topics: ReadonlyArray<string | null | undefined>;
}

interface ReceiptLike {
  logs: ReadonlyArray<ReceiptLog>;
}

const lower = (values: ReadonlyArray<string | null | undefined>): Set<string> =>
  new Set(values.filter((v): v is string => Boolean(v)).map((v) => v.toLowerCase()));

/** ABI-encoded (left-padded) form of an address, as it appears in an indexed topic. */
export function addressTopic(address: string): string {
  return `0x${address.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`;
}

/**
 * True when the receipt holds the factory's launch event (TokenLaunchedV2 / TokenLaunchedV4)
 * for `token`: a log from a factory whose first indexed topic is the token address.
 */
export function isLaunchReceiptFor(
  receipt: ReceiptLike,
  token: string,
  network: { contracts: { factory?: string; factoryV2?: string } },
): boolean {
  const factories = lower([network.contracts.factory, network.contracts.factoryV2]);
  const topic = addressTopic(token);
  return receipt.logs.some(
    (log) => factories.has(log.address.toLowerCase()) && log.topics[1]?.toLowerCase() === topic,
  );
}

/** The logs of a receipt emitted by one of `emitters` (e.g. the token's bonding curve). */
export function logsFrom<T extends ReceiptLog>(
  logs: ReadonlyArray<T>,
  emitters: ReadonlyArray<string | null | undefined>,
): T[] {
  const allowed = lower(emitters);
  return logs.filter((log) => allowed.has(log.address.toLowerCase()));
}
