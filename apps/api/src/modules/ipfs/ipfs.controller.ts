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
