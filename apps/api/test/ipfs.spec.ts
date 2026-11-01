import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uploadFile, generateDeterministicCid } from '../src/modules/ipfs/ipfs.service';
import { IpfsController } from '../src/modules/ipfs/ipfs.controller';

describe('IPFS Service & Controller', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PINATA_JWT;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Deterministic CID & Fallback', () => {
    it('generates consistent CIDv1 for identical content', async () => {
      const data1 = new TextEncoder().encode('test-image-content-12345').buffer;
      const data2 = new TextEncoder().encode('test-image-content-12345').buffer;

      const cid1 = await generateDeterministicCid(data1);
      const cid2 = await generateDeterministicCid(data2);

      expect(cid1).toBe(cid2);
      expect(cid1.startsWith('bafkrei')).toBe(true);
      expect(cid1.length).toBeGreaterThan(20);
    });

    it('generates different CIDs for different contents', async () => {
      const data1 = new TextEncoder().encode('token-image-A').buffer;
      const data2 = new TextEncoder().encode('token-image-B').buffer;

      const cid1 = await generateDeterministicCid(data1);
      const cid2 = await generateDeterministicCid(data2);

      expect(cid1).not.toBe(cid2);
    });

    it('falls back to deterministic CID when Pinata upload fails', async () => {
      process.env.PINATA_JWT = 'dummy-jwt-token';
      const buffer = new TextEncoder().encode('offline-payload').buffer;

      // Mock global fetch to throw network error simulating Pinata offline
      const originalFetch = global.fetch;
      global.fetch = vi
        .fn()
        .mockRejectedValue(new Error('Network offline')) as unknown as typeof fetch;

      const result = await uploadFile(buffer, 'test.png', 'image/png');

      expect(result.cid.startsWith('bafkrei')).toBe(true);
      expect(result.url).toContain(result.cid);

      global.fetch = originalFetch;
    });

    it('uses deterministic CID directly when PINATA_JWT is not set', async () => {
      const buffer = new TextEncoder().encode('no-pinata-token').buffer;
      const result = await uploadFile(buffer, 'logo.png', 'image/png');

      expect(result.cid.startsWith('bafkrei')).toBe(true);
      expect(result.url).toBe(`/api/ipfs/${result.cid}`);
      expect(result.uri).toBe(`ipfs://${result.cid}`);
    });
  });

  describe('POST /api/ipfs/upload HTTP Integration', () => {
    const controller = new IpfsController();
    const JPEG = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.from('token-logo-bytes'),
    ]);
    const PNG = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('binary-file-content'),
    ]);

    it('handles JSON base64 upload over HTTP', async () => {
      const base64Data = JPEG.toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64Data}`;

      const req = new Request('http://localhost:3001/api/ipfs/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, fileName: 'logo.jpg' }),
      });

      const response = await controller.handleUpload(req);
      expect(response.success).toBe(true);
      if (response.success && response.data) {
        expect(response.data.cid).toBeDefined();
        expect(response.data.cid.startsWith('bafkrei')).toBe(true);
        expect(response.data.url).toContain(response.data.cid);
      }
    });

    it('handles multipart form data over HTTP', async () => {
      const formData = new FormData();
      const blob = new Blob([PNG], { type: 'image/png' });
      formData.append('file', blob, 'coin.png');

      const req = new Request('http://localhost:3001/api/ipfs/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await controller.handleUpload(req);
      expect(response.success).toBe(true);
      if (response.success && response.data) {
        expect(response.data.cid).toBeDefined();
        expect(response.data.url).toContain(response.data.cid);
      }
    });

    it('rejects a file whose bytes are not the image type it claims', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['<html>not a png</html>'], { type: 'image/png' }), 'x.png');
      const req = new Request('http://localhost:3001/api/ipfs/upload', {
        method: 'POST',
        body: formData,
      });
      const response = await controller.handleUpload(req);
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('CONTENT_TYPE_MISMATCH');

      const json = await controller.handleUpload(
        new Request('http://localhost:3001/api/ipfs/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: `data:image/jpeg;base64,${PNG.toString('base64')}` }),
        }),
      );
      expect(json.error?.code).toBe('CONTENT_TYPE_MISMATCH');
    });

    it('returns error on a JSON upload without data', async () => {
      const response = await controller.handleUpload(
        new Request('http://localhost:3001/api/ipfs/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: 'empty.png' }),
        }),
      );
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('MISSING_DATA');
    });

    it('returns error on empty multipart upload without file', async () => {
      const formData = new FormData();
      formData.append('empty', 'not-a-file');

      const req = new Request('http://localhost:3001/api/ipfs/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await controller.handleUpload(req);
      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error?.code).toBe('NO_FILE_PROVIDED');
      }
    });
  });
});
