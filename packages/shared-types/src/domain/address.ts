/** Whether `value` is a 0x-prefixed 20-byte hex address (checksum not enforced). */
export function isAddress(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);
}
