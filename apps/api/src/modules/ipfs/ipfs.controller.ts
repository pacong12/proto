import { ApiEnvelope, ok, err } from '@proto/shared-types';
import { IpfsService } from './ipfs.service';

export interface IpfsUploadResult {
  cid: string;
  url: string;
}

export interface IpfsDirectUploadPayload {
  dataUrl?: string;
  file?: string;
  image?: string;
  data?: string;
  fileName?: string;
  mimeType?: string;
  fileBuffer?: ArrayBuffer | Buffer;
}
/** Off-chain token metadata (Metaplex / Token-2022 compatible JSON) pinned for Solana launches. */
export interface TokenMetadataDocument {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url?: string;
  extensions?: {
    website?: string;
    twitter?: string;
    telegram?: string;
  };
}

export class IpfsController {
  constructor(private readonly ipfsService: IpfsService = new IpfsService()) {}

  // MIME type whitelist: only image formats accepted.
  // Executable, HTML, and other dangerous types are rejected before any bytes are processed.
  private static readonly ALLOWED_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ]);
  // 5 MiB hard limit; reject before passing to IpfsService to prevent OOM from large uploads.
  private static readonly MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

  /**
   * Scan SVG byte stream for executable scripts, inline event handlers, or dangerous foreignObjects.
   * Prevents SVG-based Stored Cross-Site Scripting (XSS).
   * Uses linear non-backtracking patterns to prevent polynomial ReDoS.
   */
  private static isMaliciousSvg(buffer: ArrayBuffer | Buffer): boolean {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const text = buf.toString('utf8').toLowerCase();
    return (
      text.includes('<script') ||
      text.includes('javascript:') ||
      text.includes('data:text/html') ||
      text.includes('<foreignobject') ||
      /\bon[a-z]+\s*=/i.test(text)
    );
  }

  // Metadata JSON is tiny; anything larger is either abuse or a mistake.
  private static readonly MAX_METADATA_BYTES = 16 * 1024;

  private static readonly SAFE_URL = /^(https:\/\/|ipfs:\/\/)[^\s<>"']{1,2040}$/;

  /**
   * Validate an untrusted metadata payload and rebuild it from known fields only,
   * so arbitrary keys or non-string values can never be pinned.
   */
  static sanitizeTokenMetadata(
    input: unknown,
  ): { ok: true; value: TokenMetadataDocument } | { ok: false; message: string } {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return { ok: false, message: 'Metadata must be a JSON object' };
    }
    const body = input as Record<string, unknown>;
    const str = (key: string) =>
      typeof body[key] === 'string' ? (body[key] as string).trim() : '';

    const name = str('name');
    const symbol = str('symbol');
    const description = str('description');
    const image = str('image');

    if (!name || name.length > 32) return { ok: false, message: 'name must be 1-32 characters' };
    if (!symbol || symbol.length > 10 || !/^[A-Za-z0-9]+$/.test(symbol)) {
      return { ok: false, message: 'symbol must be 1-10 alphanumeric characters' };
    }
    if (description.length > 1000) {
      return { ok: false, message: 'description must be at most 1000 characters' };
    }
    if (image && !IpfsController.SAFE_URL.test(image)) {
      return { ok: false, message: 'image must be an https:// or ipfs:// URL' };
    }

    const value: TokenMetadataDocument = { name, symbol, description, image };

    const rawExtensions =
      body.extensions && typeof body.extensions === 'object' && !Array.isArray(body.extensions)
        ? (body.extensions as Record<string, unknown>)
        : {};
    const extensions: NonNullable<TokenMetadataDocument['extensions']> = {};
    for (const key of ['website', 'twitter', 'telegram'] as const) {
      const raw =
        typeof rawExtensions[key] === 'string' ? (rawExtensions[key] as string).trim() : '';
      if (!raw) continue;
      if (!IpfsController.SAFE_URL.test(raw)) {
        return { ok: false, message: `extensions.${key} must be an https:// URL` };
      }
      extensions[key] = raw;
    }
    if (Object.keys(extensions).length > 0) {
      value.extensions = extensions;
      if (extensions.website) value.external_url = extensions.website;
    }

    return { ok: true, value };
  }

  /** POST /api/ipfs/metadata: pin a validated token metadata JSON document. */
  async handleMetadataUpload(req: Request): Promise<ApiEnvelope<IpfsUploadResult>> {
    try {
      const contentType = req.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return err('UNSUPPORTED_MEDIA_TYPE', 'Request must be application/json');
      }
      const raw = await req.text();
      if (new TextEncoder().encode(raw).byteLength > IpfsController.MAX_METADATA_BYTES) {
        return err('PAYLOAD_TOO_LARGE', 'Metadata exceeds 16 KiB limit');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return err('INVALID_JSON', 'Body is not valid JSON');
      }

      const result = IpfsController.sanitizeTokenMetadata(parsed);
      if (!result.ok) return err('INVALID_METADATA', result.message);

      const document = Buffer.from(JSON.stringify(result.value), 'utf8');
      const uploaded = await this.ipfsService.uploadFile(
        document,
        `${result.value.symbol.toLowerCase()}-metadata.json`,
        'application/json',
      );
      return ok(uploaded);
    } catch {
      return err('UPLOAD_FAILED', 'Failed to process metadata upload');
    }
  }

  async handleUpload(req: Request): Promise<ApiEnvelope<IpfsUploadResult>> {
    try {
      const cl = req.headers.get('content-length');
      if (cl && parseInt(cl, 10) > IpfsController.MAX_UPLOAD_BYTES) {
        return err('FILE_TOO_LARGE', 'Upload exceeds 5 MiB limit');
      }

      const contentType = req.headers.get('content-type') || '';

      if (contentType.includes('multipart/form-data')) {
        const formData = await req.formData();
        const file = formData.get('file') ?? formData.get('image') ?? formData.get('data');
        if (!file) {
          return err('NO_FILE_PROVIDED', 'No file found in multipart upload');
        }

        if (typeof file === 'string') {
          return err('UNSUPPORTED_FORMAT', 'String fields are not accepted; send a file part');
        }

        const arrayBuffer = await file.arrayBuffer();
        const fileName = (file as File).name || 'upload.bin';
        const mimeType = (file as File).type || 'application/octet-stream';

        if (!IpfsController.ALLOWED_MIME_TYPES.has(mimeType)) {
          return err(
            'UNSUPPORTED_MIME_TYPE',
            `Only image uploads are accepted. Received: ${mimeType}`,
          );
        }
        if (arrayBuffer.byteLength > IpfsController.MAX_UPLOAD_BYTES) {
          return err('FILE_TOO_LARGE', 'Upload exceeds 5 MiB limit');
        }
        if (mimeType === 'image/svg+xml' && IpfsController.isMaliciousSvg(arrayBuffer)) {
          return err(
            'MALICIOUS_PAYLOAD',
            'SVG contains disallowed executable scripts or event handlers',
          );
        }

        const result = await this.ipfsService.uploadFile(arrayBuffer, fileName, mimeType);
        return ok(result);
      }

      if (contentType.includes('application/json')) {
        const body = (await req.json()) as {
          dataUrl?: string;
          file?: string;
          image?: string;
          data?: string;
          fileName?: string;
          mimeType?: string;
        };

        const rawContent = body.dataUrl || body.file || body.image || body.data;
        if (!rawContent) {
          return err(
            'MISSING_DATA',
            'JSON payload must contain a "dataUrl", "file", "image", or "data" field',
          );
        }

        let mimeType = body.mimeType || 'application/octet-stream';
        let base64Data = rawContent;

        const dataUrlMatch = rawContent.match(/^data:([^;]+);base64,(.+)$/);
        if (dataUrlMatch) {
          mimeType = dataUrlMatch[1];
          base64Data = dataUrlMatch[2];
        }

        if (!IpfsController.ALLOWED_MIME_TYPES.has(mimeType)) {
          return err(
            'UNSUPPORTED_MIME_TYPE',
            `Only image uploads are accepted. Received: ${mimeType}`,
          );
        }

        const buffer = Buffer.from(base64Data, 'base64');
        if (buffer.byteLength > IpfsController.MAX_UPLOAD_BYTES) {
          return err('FILE_TOO_LARGE', 'Upload exceeds 5 MiB limit');
        }
        if (mimeType === 'image/svg+xml' && IpfsController.isMaliciousSvg(buffer)) {
          return err(
            'MALICIOUS_PAYLOAD',
            'SVG contains disallowed executable scripts or event handlers',
          );
        }

        const fileName =
          body.fileName ||
          (mimeType.includes('image/') ? `image.${mimeType.split('/')[1]}` : 'upload.bin');
        const result = await this.ipfsService.uploadFile(buffer, fileName, mimeType);
        return ok(result);
      }

      // Raw binary body fallback
      const arrayBuffer = await req.arrayBuffer();
      if (arrayBuffer.byteLength > 0) {
        const mimeType = contentType.split(';')[0].trim() || 'application/octet-stream';
        if (!IpfsController.ALLOWED_MIME_TYPES.has(mimeType)) {
          return err(
            'UNSUPPORTED_MIME_TYPE',
            `Only image uploads are accepted. Received: ${mimeType}`,
          );
        }
        if (arrayBuffer.byteLength > IpfsController.MAX_UPLOAD_BYTES) {
          return err('FILE_TOO_LARGE', 'Upload exceeds 5 MiB limit');
        }
        if (mimeType === 'image/svg+xml' && IpfsController.isMaliciousSvg(arrayBuffer)) {
          return err(
            'MALICIOUS_PAYLOAD',
            'SVG contains disallowed executable scripts or event handlers',
          );
        }
        const fileName = req.headers.get('x-file-name') || 'upload.bin';
        const result = await this.ipfsService.uploadFile(arrayBuffer, fileName, mimeType);
        return ok(result);
      }

      return err(
        'UNSUPPORTED_MEDIA_TYPE',
        'Request must be multipart/form-data or application/json',
      );
    } catch {
      return err('UPLOAD_FAILED', 'Failed to process upload');
    }
  }

  async upload(input: Request | IpfsDirectUploadPayload): Promise<ApiEnvelope<IpfsUploadResult>> {
    if ('headers' in input && typeof input.headers?.get === 'function') {
      return this.handleUpload(input as Request);
    }

    const payload = input as IpfsDirectUploadPayload;
    if (payload.fileBuffer) {
      return this.uploadBuffer(
        payload.fileBuffer,
        payload.fileName || 'upload.bin',
        payload.mimeType || 'application/octet-stream',
      );
    }

    const rawContent = payload.dataUrl || payload.file || payload.image || payload.data;
    if (!rawContent) {
      return err('INVALID_BASE64_PAYLOAD', 'Payload missing dataUrl');
    }

    let mimeType = payload.mimeType || 'application/octet-stream';
    let base64Data = rawContent;
    const dataUrlMatch = rawContent.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1];
      base64Data = dataUrlMatch[2];
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const fileName =
      payload.fileName ||
      (mimeType.includes('image/') ? `image.${mimeType.split('/')[1]}` : 'upload.bin');
    return this.uploadBuffer(buffer, fileName, mimeType);
  }
  async uploadBuffer(
    fileBuffer: Buffer | ArrayBuffer,
    fileName = 'upload.bin',
    mimeType = 'application/octet-stream',
  ): Promise<ApiEnvelope<IpfsUploadResult>> {
    try {
      if (mimeType === 'image/svg+xml' && IpfsController.isMaliciousSvg(fileBuffer)) {
        return err(
          'MALICIOUS_PAYLOAD',
          'SVG contains disallowed executable scripts or event handlers',
        );
      }
      const result = await this.ipfsService.uploadFile(fileBuffer, fileName, mimeType);
      return ok(result);
    } catch (error) {
      return err('UPLOAD_FAILED', (error as Error).message);
    }
  }
}
