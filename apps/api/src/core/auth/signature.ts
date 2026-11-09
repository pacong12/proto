import { parseSignature, type Hex } from 'viem';

/** secp256k1 group order. */
const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

/**
 * One key per signature, whatever its encoding. verifyMessage accepts the same signature with
 * v as 27/28 or 0/1, with s or n - s (the other parity), and in either hex case, so the raw
 * string cannot key a one-use check: each variant would count as a new signature. Null when the
 * signature does not parse.
 */
export function canonicalSignatureKey(signature: Hex): string | null {
  try {
    const { r, s } = parseSignature(signature);
    const sValue = BigInt(s);
    const lowS = sValue > SECP256K1_N / 2n ? SECP256K1_N - sValue : sValue;
    return `${BigInt(r).toString(16).padStart(64, '0')}${lowS.toString(16).padStart(64, '0')}`;
  } catch {
    return null;
  }
}
