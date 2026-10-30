import fs from 'fs';
import path from 'path';
import type { FileStorePort, StoredFile } from '../domain/ports/ipfs-storage.port';

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

/** Uploads on local disk (UPLOADS_DIR): `<cid>` holds the bytes, `<cid>.meta.json` the type. */
export class LocalFileStore implements FileStorePort {
  save(cid: string, data: Buffer, mimeType: string, fileName: string): void {
    try {
      const dir = getUploadDir();
      fs.writeFileSync(path.join(dir, cid), data);
      fs.writeFileSync(
        path.join(dir, `${cid}.meta.json`),
        JSON.stringify({ mimeType, fileName, timestamp: Date.now() }),
      );
    } catch (err) {
      console.warn('[IPFS] Failed to persist file locally:', err);
    }
  }

  read(cid: string): StoredFile | null {
    const dir = getUploadDir();
    const filePath = path.join(dir, cid);
    if (!fs.existsSync(filePath)) return null;
    try {
      const data = fs.readFileSync(filePath);
      let mimeType = 'image/webp';
      const metaPath = path.join(dir, `${cid}.meta.json`);
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
      console.warn(`[IPFS] Error reading local file ${cid}:`, err);
      return null;
    }
  }
}
