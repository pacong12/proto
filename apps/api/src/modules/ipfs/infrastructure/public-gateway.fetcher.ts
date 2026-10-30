import { readBounded } from '../../../core/http/parse-body';
import { verifyCidContent } from '../domain/cid';
import type { ContentFetcherPort, StoredFile } from '../domain/ports/ipfs-storage.port';

/** Most bytes read from a gateway; a bounded stream, since gateways may omit Content-Length. */
const MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Reads content from public gateways in turn. What they return is not written to disk: any
 * visitor can request any CID, so persisting it would let them fill the disk (API-06).
 */
export class PublicGatewayFetcher implements ContentFetcherPort {
  async fetch(cid: string): Promise<StoredFile | null> {
    const gateways = [
      `https://ipfs.filebase.io/ipfs/${cid}`,
      `https://4everland.io/ipfs/${cid}`,
      `https://gateway.pinata.cloud/ipfs/${cid}`,
      `https://cloudflare-ipfs.com/ipfs/${cid}`,
    ];
    for (const gw of gateways) {
      try {
        const res = await fetch(gw, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) continue;
        const contentLength = res.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > MAX_DOWNLOAD_BYTES) {
          await res.body?.cancel();
          continue;
        }
        const bytes = await readBounded(res.body, MAX_DOWNLOAD_BYTES);
        if (!bytes) continue;
        // TKT-10: gateways can return notice pages or wrong content with HTTP 200.
        if (verifyCidContent(cid, bytes) === 'mismatch') continue;
        return {
          data: Buffer.from(bytes),
          mimeType: res.headers.get('content-type') || 'image/webp',
        };
      } catch {
        // Fallback to next gateway
      }
    }
    return null;
  }
}
