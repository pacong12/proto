import { readBounded } from '../../../core/http/parse-body';
import { verifyCidContent } from '../domain/cid';
import type { ContentFetcherPort, StoredFile } from '../domain/ports/ipfs-storage.port';

/** Most bytes read from a gateway; a bounded stream, since gateways may omit Content-Length. */
const MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024;

/**
 * How long a lookup may take in all. It stays under Bun's 10s idle timeout, so a CID no gateway
 * has is answered with a 404 instead of the connection being reset.
 */
const LOOKUP_DEADLINE_MS = 8000;

const GATEWAYS = [
  'https://ipfs.filebase.io/ipfs/',
  'https://4everland.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
];

/**
 * Reads content from public gateways, all at once: the first one to return the content wins and
 * the others are aborted. What they return is not written to disk: any visitor can request any
 * CID, so persisting it would let them fill the disk (API-06).
 */
export class PublicGatewayFetcher implements ContentFetcherPort {
  constructor(
    private readonly gateways: readonly string[] = GATEWAYS,
    private readonly deadlineMs = LOOKUP_DEADLINE_MS,
  ) {}

  async fetch(cid: string): Promise<StoredFile | null> {
    const done = new AbortController();
    const signal = AbortSignal.any([done.signal, AbortSignal.timeout(this.deadlineMs)]);
    try {
      return await Promise.any(this.gateways.map((gw) => fetchFrom(`${gw}${cid}`, cid, signal)));
    } catch {
      return null; // no gateway had it in time
    } finally {
      done.abort();
    }
  }
}

/** The content of `cid` at `url`; rejects when the gateway does not serve it. */
async function fetchFrom(url: string, cid: string, signal: AbortSignal): Promise<StoredFile> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentLength = res.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_DOWNLOAD_BYTES) {
    await res.body?.cancel();
    throw new Error('too large');
  }
  const bytes = await readBounded(res.body, MAX_DOWNLOAD_BYTES);
  if (!bytes) throw new Error('too large');
  // TKT-10: gateways can return notice pages or wrong content with HTTP 200.
  if (verifyCidContent(cid, bytes) === 'mismatch') throw new Error('content mismatch');
  return { data: Buffer.from(bytes), mimeType: res.headers.get('content-type') || 'image/webp' };
}
