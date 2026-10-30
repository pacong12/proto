import crypto from 'crypto';

/**
 * TKT-10: checks that bytes served by a public gateway really are the content addressed by a CID.
 * Supports sha2-256 CIDs for:
 *   - raw leaves (CIDv1 codec 0x55): digest = sha256(content);
 *   - single-block UnixFS files (CIDv0 / CIDv1 dag-pb 0x70, content ≤ one 256 KiB chunk):
 *     digest = sha256(PBNode{ Data: UnixFS{ Type: File, Data: content, filesize } }).
 * Larger, chunked files cannot be checked without their DAG and report 'unverifiable'.
 */
export type CidCheck = 'match' | 'mismatch' | 'unverifiable';

const CODEC_RAW = 0x55;
const CODEC_DAG_PB = 0x70;
const SHA2_256 = 0x12;
/** Default kubo / Pinata chunk size: files up to this size are a single block. */
export const SINGLE_BLOCK_MAX_BYTES = 262_144;

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';

function base58Decode(input: string): Uint8Array | null {
  let value = 0n;
  for (const char of input) {
    const digit = BASE58.indexOf(char);
    if (digit < 0) return null;
    value = value * 58n + BigInt(digit);
  }
  const bytes: number[] = [];
  while (value > 0n) {
    bytes.unshift(Number(value & 0xffn));
    value >>= 8n;
  }
  for (const char of input) {
    if (char !== '1') break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

function base32Decode(input: string): Uint8Array | null {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of input.toLowerCase()) {
    const value = BASE32.indexOf(char);
    if (value < 0) return null;
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

function readVarint(bytes: Uint8Array, offset: number): [number, number] | null {
  let value = 0;
  let shift = 0;
  for (let i = offset; i < bytes.length && shift < 35; i++) {
    value |= (bytes[i] & 0x7f) << shift;
    if ((bytes[i] & 0x80) === 0) return [value >>> 0, i + 1];
    shift += 7;
  }
  return null;
}

function varint(value: number): number[] {
  const out: number[] = [];
  while (value >= 0x80) {
    out.push((value & 0x7f) | 0x80);
    value = Math.floor(value / 128);
  }
  out.push(value);
  return out;
}

/** Parses a sha2-256 CID into its codec and digest; null for anything else. */
function parseCid(cid: string): { codec: number; digest: Uint8Array } | null {
  let codec: number;
  let multihash: Uint8Array;
  if (cid.startsWith('Qm') && cid.length === 46) {
    const bytes = base58Decode(cid);
    if (!bytes) return null;
    codec = CODEC_DAG_PB;
    multihash = bytes;
  } else if (cid.startsWith('b')) {
    const bytes = base32Decode(cid.slice(1));
    const version = bytes && readVarint(bytes, 0);
    if (!bytes || !version || version[0] !== 1) return null;
    const codecRead = readVarint(bytes, version[1]);
    if (!codecRead) return null;
    codec = codecRead[0];
    multihash = bytes.slice(codecRead[1]);
  } else {
    return null;
  }
  if (multihash.length !== 34 || multihash[0] !== SHA2_256 || multihash[1] !== 32) return null;
  return { codec, digest: multihash.slice(2) };
}

/** Serialized dag-pb node of a single-block UnixFS file holding `content`. */
function unixfsFileBlock(content: Uint8Array): Buffer {
  const unixfs = [0x08, 0x02]; // Type = File
  if (content.length > 0) unixfs.push(0x12, ...varint(content.length), ...content); // Data
  unixfs.push(0x18, ...varint(content.length)); // filesize
  return Buffer.from([0x0a, ...varint(unixfs.length), ...unixfs]); // PBNode.Data
}

export function verifyCidContent(cid: string, content: Uint8Array): CidCheck {
  const parsed = parseCid(cid);
  if (!parsed) return 'unverifiable';
  let hashed: Uint8Array;
  if (parsed.codec === CODEC_RAW) {
    hashed = content;
  } else if (parsed.codec === CODEC_DAG_PB && content.length <= SINGLE_BLOCK_MAX_BYTES) {
    hashed = unixfsFileBlock(content);
  } else {
    return 'unverifiable';
  }
  const digest = crypto.createHash('sha256').update(hashed).digest();
  return Buffer.compare(digest, Buffer.from(parsed.digest)) === 0 ? 'match' : 'mismatch';
}
