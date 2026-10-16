import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { readBounded } from '../../core/http/parse-body';
import { verifyCidContent } from './cid-verify';

function getUploadDir(): string {
  const dir = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // Directory creation fallback if already exists
    }
  }
  return dir;
}

function saveLocalFile(cid: string, buf: Buffer, mimeType: string, fileName: string): void {
  try {
    const dir = getUploadDir();
    const filePath = path.join(dir, cid);
    fs.writeFileSync(filePath, buf);
    const metaPath = path.join(dir, `${cid}.meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify({ mimeType, fileName, timestamp: Date.now() }));
  } catch (err) {
    console.warn('[IPFS] Failed to persist file locally:', err);
  }
}

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

function encodeBase32(buf: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/**
 * Generate a deterministic fallback IPFS CIDv1 (raw codec, e.g. bafkrei...)
 * using SHA-256 multihash and dag-pb multicodec (0x70).
 */
export function generateDeterministicCid(fileBuffer: Buffer | ArrayBuffer): string {
  const buf = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
  const hash = crypto.createHash('sha256').update(buf).digest();
  // CIDv1 raw (0x55) with sha2-256 (0x12) length 32 (0x20): the digest is of the raw bytes,
  // so the codec must be raw (labelling it dag-pb produced a CID no IPFS node would serve).
  const multihash = Buffer.concat([Buffer.from([0x01, 0x55, 0x12, 0x20]), hash]);
  return 'b' + encodeBase32(multihash);
}

/**
 * Upload a file to IPFS via Pinata when PINATA_JWT is present.
 * If Pinata fails or PINATA_JWT is not set, falls back to a deterministic IPFS CID
 * and mock/gateway URL to guarantee token launches are never blocked.
 */
export async function uploadFile(
  fileBuffer: Buffer | ArrayBuffer,
  fileName: string,
  mimeType: string,
): Promise<{ cid: string; url: string; uri: string }> {
  const buf = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
  const pinataJwt = process.env.PINATA_JWT?.trim();

  if (pinataJwt) {
    try {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(buf)], { type: mimeType });
      formData.append('file', blob, fileName);

      const metadata = JSON.stringify({ name: fileName });
      formData.append('pinataMetadata', metadata);

      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${pinataJwt}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = (await response.json()) as { IpfsHash?: string };
        if (data && data.IpfsHash) {
          const cid = data.IpfsHash;
          saveLocalFile(cid, buf, mimeType, fileName);
          const gateway = process.env.IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';
          const cleanGateway = gateway.endsWith('/') ? gateway : `${gateway}/`;
          return {
            cid,
            url: `${cleanGateway}${cid}`,
            uri: `ipfs://${cid}`,
          };
        }
      } else {
        console.warn(
          `Pinata upload failed with status ${response.status}: ${await response.text()}`,
        );
      }
    } catch (err) {
      console.warn('Pinata IPFS upload network error, falling back to deterministic CID:', err);
    }
  }

  // Deterministic fallback (offline or Pinata failure)
  const cid = generateDeterministicCid(buf);
  saveLocalFile(cid, buf, mimeType, fileName);
  const gateway = process.env.IPFS_GATEWAY || '/api/ipfs/';
  const cleanGateway = gateway.endsWith('/') ? gateway : `${gateway}/`;

  return {
    cid,
    url: `${cleanGateway}${cid}`,
    uri: `ipfs://${cid}`,
  };
}

export class IpfsService {
  async uploadFile(
    fileBuffer: Buffer | ArrayBuffer,
    fileName: string,
    mimeType: string,
  ): Promise<{ cid: string; url: string; uri: string }> {
    return uploadFile(fileBuffer, fileName, mimeType);
  }

  async getFile(cid: string): Promise<{ data: Buffer; mimeType: string } | null> {
    const cleanCid = cid.replace(/[^a-zA-Z0-9]/g, '');
    if (!cleanCid) return null;

    const dir = getUploadDir();
    const filePath = path.join(dir, cleanCid);
    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath);
        let mimeType = 'image/webp';
        const metaPath = path.join(dir, `${cleanCid}.meta.json`);
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            if (meta.mimeType) mimeType = meta.mimeType;
          } catch {
            // Use default webp mime type
          }
        }
        return { data, mimeType };
      } catch (err) {
        console.warn(`[IPFS] Error reading local file ${cleanCid}:`, err);
      }
    }

    // Remote fallback: fetch from public gateways, max 5 MiB read as a bounded stream (gateways may
    // omit Content-Length). Remote content is not written to disk: any visitor can request any CID,
    // so persisting it would let them fill the disk (API-06). Uploads are still stored locally.
    const MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024;
    const gateways = [
      `https://ipfs.filebase.io/ipfs/${cleanCid}`,
      `https://4everland.io/ipfs/${cleanCid}`,
      `https://gateway.pinata.cloud/ipfs/${cleanCid}`,
      `https://cloudflare-ipfs.com/ipfs/${cleanCid}`,
    ];

    for (const gw of gateways) {
      try {
        const res = await fetch(gw, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const contentLength = res.headers.get('content-length');
          if (contentLength && parseInt(contentLength, 10) > MAX_DOWNLOAD_BYTES) {
            await res.body?.cancel();
            continue;
          }
          const bytes = await readBounded(res.body, MAX_DOWNLOAD_BYTES);
          if (!bytes) continue;
          // TKT-10: gateways can return notice pages or wrong content with HTTP 200.
          if (verifyCidContent(cleanCid, bytes) === 'mismatch') continue;
          const mime = res.headers.get('content-type') || 'image/webp';
          return { data: Buffer.from(bytes), mimeType: mime };
        }
      } catch {
        // Fallback to next gateway
      }
    }

    return null;
  }
}
