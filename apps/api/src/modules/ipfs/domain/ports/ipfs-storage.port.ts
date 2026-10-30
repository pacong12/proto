/** A file's bytes and the MIME type it is served with. */
export interface StoredFile {
  data: Buffer;
  mimeType: string;
}

/** Files kept by this API under their CID (uploads, so they are served without a gateway). */
export interface FileStorePort {
  save(cid: string, data: Buffer, mimeType: string, fileName: string): void;
  read(cid: string): StoredFile | null;
}

/** A pinning service that keeps uploads on IPFS. */
export interface PinningPort {
  /** The CID the file was pinned under, or null when pinning is off or failed. */
  pin(data: Buffer, fileName: string, mimeType: string): Promise<string | null>;
}

/** Public IPFS gateways, for content this API does not hold. */
export interface ContentFetcherPort {
  fetch(cid: string): Promise<StoredFile | null>;
}
