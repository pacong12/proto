import sharp from 'sharp';
import type { IpfsService } from '../../ipfs';
import type { ImageLoaderPort } from '../application/pnl-card';

/** Side of the PNG an image is scaled to, in pixels (twice the size the card draws it at). */
const SIZE = 128;
/** Larger images are not decoded. */
const MAX_INPUT_PIXELS = 16_000_000;
/** How long a logo may take to load before the card is drawn without it. */
const LOAD_TIMEOUT_MS = 3000;

/** The CID of an ipfs:// URI or of a gateway / API URL (…/ipfs/<cid>), else null. */
export function cidOf(uri: string): string | null {
  const match = uri.trim().match(/^ipfs:\/\/(?:ipfs\/)?([a-zA-Z0-9]+)|\/ipfs\/([a-zA-Z0-9]+)/);
  return match?.[1] ?? match?.[2] ?? null;
}

/**
 * Loads token logos from IPFS through the ipfs module (its own copies first, then public
 * gateways), as square PNGs: the card renderer reads PNG and JPEG only, and logos are mostly
 * WebP. Only IPFS content is loaded, never an arbitrary URL, so a logo cannot make the API
 * request other hosts.
 */
export class IpfsImageLoader implements ImageLoaderPort {
  constructor(
    private readonly ipfs: Pick<IpfsService, 'getFile'>,
    private readonly timeoutMs = LOAD_TIMEOUT_MS,
  ) {}

  async pngDataUrl(uri: string): Promise<string | null> {
    const cid = cidOf(uri);
    if (!cid) return null;
    try {
      const file = await Promise.race([
        this.ipfs.getFile(cid),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), this.timeoutMs)),
      ]);
      if (!file) return null;
      const png = await sharp(file.data, { limitInputPixels: MAX_INPUT_PIXELS })
        .resize(SIZE, SIZE, { fit: 'cover' })
        .png()
        .toBuffer();
      return `data:image/png;base64,${png.toString('base64')}`;
    } catch {
      return null; // not an image sharp reads: the card draws the token's initial
    }
  }
}
