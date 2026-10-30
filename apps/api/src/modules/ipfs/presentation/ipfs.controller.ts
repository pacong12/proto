import { ApiEnvelope, ok, err } from '@goton/shared-types';
import type { IpfsService, IpfsUploadResult } from '../application/ipfs.service';
import {
  MAX_UPLOAD_BYTES,
  TOO_LARGE,
  checkImageUpload,
  isAllowedImageType,
  unsupportedType,
} from '../domain/image-upload.policy';

/** Reads an upload from a multipart, JSON (data URL / base64) or raw body and stores it. */
export class IpfsController {
  constructor(private readonly ipfsService: IpfsService) {}

  async handleUpload(req: Request): Promise<ApiEnvelope<IpfsUploadResult>> {
    try {
      const cl = req.headers.get('content-length');
      if (cl && parseInt(cl, 10) > MAX_UPLOAD_BYTES) {
        return err(TOO_LARGE.code, TOO_LARGE.message);
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

        return this.validateAndUpload(arrayBuffer, fileName, mimeType);
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

        // Checked before decoding, so an unsupported type never costs a base64 decode.
        if (!isAllowedImageType(mimeType)) {
          const rejection = unsupportedType(mimeType);
          return err(rejection.code, rejection.message);
        }
        const fileName =
          body.fileName ||
          (mimeType.includes('image/') ? `image.${mimeType.split('/')[1]}` : 'upload.bin');
        return this.validateAndUpload(Buffer.from(base64Data, 'base64'), fileName, mimeType);
      }

      // Raw binary body fallback
      const arrayBuffer = await req.arrayBuffer();
      if (arrayBuffer.byteLength > 0) {
        const mimeType = contentType.split(';')[0].trim() || 'application/octet-stream';
        const fileName = req.headers.get('x-file-name') || 'upload.bin';
        return this.validateAndUpload(arrayBuffer, fileName, mimeType);
      }

      return err(
        'UNSUPPORTED_MEDIA_TYPE',
        'Request must be multipart/form-data or application/json',
      );
    } catch {
      return err('UPLOAD_FAILED', 'Failed to process upload');
    }
  }

  /** Every upload path ends here: an allowed image type, within the size limit, whose bytes match. */
  private async validateAndUpload(
    data: ArrayBuffer | Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<ApiEnvelope<IpfsUploadResult>> {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const rejection = checkImageUpload(buf, mimeType);
    if (rejection) return err(rejection.code, rejection.message);
    return ok(await this.ipfsService.uploadFile(buf, fileName, mimeType));
  }
}
