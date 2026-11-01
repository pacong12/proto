import { generateDeterministicCid } from '../domain/cid';
import type {
  ContentFetcherPort,
  FileStorePort,
  PinningPort,
  StoredFile,
} from '../domain/ports/ipfs-storage.port';

export interface IpfsUploadResult {
  cid: string;
  url: string;
  uri: string;
}

/** IPFS_GATEWAY, else `fallback`, with a trailing slash. */
function gatewayBase(fallback: string): string {
  const gateway = process.env.IPFS_GATEWAY || fallback;
  return gateway.endsWith('/') ? gateway : `${gateway}/`;
}

/** Stores uploads and serves files by CID: local copies first, then public gateways. */
export class IpfsService {
  constructor(
    private readonly store: FileStorePort,
    private readonly pinning: PinningPort,
    private readonly fetcher: ContentFetcherPort,
  ) {}

  /**
   * Pins the file when pinning is configured. Without it, or when it fails, the file gets its
   * deterministic CID and is served by this API, so token launches are never blocked.
   */
  async uploadFile(
    fileBuffer: Buffer | ArrayBuffer,
    fileName: string,
    mimeType: string,
  ): Promise<IpfsUploadResult> {
    const buf = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const pinned = await this.pinning.pin(buf, fileName, mimeType);
    const cid = pinned ?? generateDeterministicCid(buf);
    this.store.save(cid, buf, mimeType, fileName);
    const gateway = gatewayBase(pinned ? 'https://gateway.pinata.cloud/ipfs/' : '/api/ipfs/');
    return { cid, url: `${gateway}${cid}`, uri: `ipfs://${cid}` };
  }

  async getFile(cid: string): Promise<StoredFile | null> {
    const cleanCid = cid.replace(/[^a-zA-Z0-9]/g, '');
    if (!cleanCid) return null;
    return this.store.read(cleanCid) ?? this.fetcher.fetch(cleanCid);
  }
}
