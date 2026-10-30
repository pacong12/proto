import type { Router } from '../../../core/http/router';
import type { AppContainer } from '../../../app/container';

/** HTTP routes of the ipfs module, registered in the order they are matched. */
export function registerIpfsRoutes(router: Router, deps: AppContainer): void {
  const { ipfsService, ipfsController } = deps;
  // POST /api/ipfs/upload
  router.on('POST', '/api/ipfs/upload', async ({ req, replyJson, replyError }) => {
    try {
      const res = await ipfsController.handleUpload(req);
      const status = res.success ? 200 : 400;
      return replyJson(res, status);
    } catch {
      return replyError('UPLOAD_ERROR', 'Failed to process upload', 500);
    }
  });

  router.on(
    ['GET', 'HEAD'],
    /^\/api\/ipfs\/([a-zA-Z0-9]+)$/,
    async ({ req, replyError }, ipfsGetMatch) => {
      try {
        const cid = ipfsGetMatch[1];
        const file = await ipfsService.getFile(cid);
        if (!file) {
          return replyError('FILE_NOT_FOUND', 'IPFS file not found', 404);
        }
        // API-05 hardening: only images are rendered inline; anything else is a download.
        const isImage = /^image\/(png|jpe?g|gif|webp|avif)$/i.test(file.mimeType);
        return new Response(req.method === 'HEAD' ? null : new Uint8Array(file.data), {
          status: 200,
          headers: {
            'Content-Type': isImage ? file.mimeType : 'application/octet-stream',
            ...(isImage ? {} : { 'Content-Disposition': 'attachment' }),
            'Content-Length': file.data.byteLength.toString(),
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
            'X-Content-Type-Options': 'nosniff',
            'Cross-Origin-Resource-Policy': 'cross-origin',
          },
        });
      } catch {
        return replyError('FETCH_ERROR', 'Failed to retrieve IPFS file', 500);
      }
    },
  );
}
