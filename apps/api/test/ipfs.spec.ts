import { server } from '../src/server';
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
      expect(cid1.startsWith('bafybei')).toBe(true);
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

      expect(result.cid.startsWith('bafybei')).toBe(true);
      expect(result.url).toContain(result.cid);

      global.fetch = originalFetch;
    });

    it('uses deterministic CID directly when PINATA_JWT is not set', async () => {
      const buffer = new TextEncoder().encode('no-pinata-token').buffer;
      const result = await uploadFile(buffer, 'logo.png', 'image/png');

      expect(result.cid.startsWith('bafybei')).toBe(true);
      expect(result.url).toBe(`https://ipfs.io/ipfs/${result.cid}`);
    });
  });

  describe('IpfsController Unit Tests', () => {
    const controller = new IpfsController();

    it('handles base64 JSON payload successfully', async () => {
      const base64Data = Buffer.from('my-token-icon-png').toString('base64');
      const dataUrl = `data:image/png;base64,${base64Data}`;

      const res = await controller.upload({
        dataUrl,
        fileName: 'icon.png',
      });

      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.cid).toBeDefined();
        expect(res.data.cid.startsWith('bafybei')).toBe(true);
        expect(res.data.url).toContain(res.data.cid);
      }
    });

    it('returns error when base64 payload is missing dataUrl', async () => {
      const res = await controller.upload({
        fileName: 'empty.png',
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error?.code).toBe('INVALID_BASE64_PAYLOAD');
      }
    });

    it('handles multipart/form-data via file buffer', async () => {
      const buffer = new TextEncoder().encode('binary-multipart-image').buffer;
      const res = await controller.upload({
        fileBuffer: buffer,
        fileName: 'token.png',
        mimeType: 'image/png',
      });

      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.cid).toBeDefined();
        expect(res.data.cid.startsWith('bafybei')).toBe(true);
      }
    });
  });

  describe('POST /api/ipfs/upload HTTP Integration', () => {
    it('handles JSON base64 upload over HTTP', async () => {
      const base64Data = Buffer.from('token-logo-bytes').toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64Data}`;

      const req = new Request('http://localhost:3001/api/ipfs/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, fileName: 'logo.jpg' }),
      });

      const response = await server.fetch(req);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.cid).toBeDefined();
      expect(json.data.cid.startsWith('bafybei')).toBe(true);
      expect(json.data.url).toBe(`https://ipfs.io/ipfs/${json.data.cid}`);
    });

    it('handles multipart form data over HTTP', async () => {
      const formData = new FormData();
      const blob = new Blob(['binary-file-content'], { type: 'image/png' });
      formData.append('file', blob, 'coin.png');

      const req = new Request('http://localhost:3001/api/ipfs/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await server.fetch(req);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.cid).toBeDefined();
      expect(json.data.url).toContain(json.data.cid);
    });

    it('returns 400 Bad Request on empty multipart upload without file', async () => {
      const formData = new FormData();
      formData.append('empty', 'not-a-file');

      const req = new Request('http://localhost:3001/api/ipfs/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await server.fetch(req);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error?.code).toBe('NO_FILE_PROVIDED');
    });
  });
});
