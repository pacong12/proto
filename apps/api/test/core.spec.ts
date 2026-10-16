import { describe, it, expect } from 'vitest';
import {
  NotFoundError,
  ValidationError,
  PayloadTooLargeError,
  RateLimitExceededError,
  UnauthorizedError,
  safeStringify,
  deriveEnvelopeStatus,
  replyError,
  replyJson,
  parseJsonBody,
  resolveCorsOrigin,
  buildSecurityHeaders,
  resolveRateLimitTier,
} from '../src/core';

describe('API Core Infrastructure', () => {
  describe('Standardized Application Errors', () => {
    it('sets correct status codes and error codes', () => {
      const notFound = new NotFoundError('Token missing');
      expect(notFound.statusCode).toBe(404);
      expect(notFound.code).toBe('NOT_FOUND');

      const val = new ValidationError('Bad input');
      expect(val.statusCode).toBe(400);

      const tooLarge = new PayloadTooLargeError();
      expect(tooLarge.statusCode).toBe(413);

      const rateLimit = new RateLimitExceededError();
      expect(rateLimit.statusCode).toBe(429);

      const unauth = new UnauthorizedError();
      expect(unauth.statusCode).toBe(401);
    });
  });

  describe('HTTP ApiEnvelope & Status Mapping', () => {
    it('serializes BigInt safely without TypeError', () => {
      const obj = { value: 12345678901234567890n };
      expect(safeStringify(obj)).toBe('{"value":"12345678901234567890"}');
    });

    it('derives correct HTTP status codes from envelopes', () => {
      expect(deriveEnvelopeStatus({ success: true })).toBe(200);
      expect(deriveEnvelopeStatus({ success: false, error: { code: 'NOT_FOUND' } })).toBe(404);
      expect(deriveEnvelopeStatus({ success: false, error: { code: 'VALIDATION_ERROR' } })).toBe(
        400,
      );
      expect(deriveEnvelopeStatus({ success: false, error: { code: 'PAYLOAD_TOO_LARGE' } })).toBe(
        413,
      );
      expect(deriveEnvelopeStatus({ success: false, error: { code: 'RATE_LIMIT_EXCEEDED' } })).toBe(
        429,
      );
      expect(deriveEnvelopeStatus({ success: false, error: { code: 'UNAUTHORIZED' } })).toBe(401);
      expect(deriveEnvelopeStatus({ success: false, error: { code: 'UNKNOWN_CRASH' } })).toBe(500);
    });

    it('creates well-formed Response objects', async () => {
      const res = replyJson({ hello: 'world' });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ hello: 'world' });

      const errRes = replyError('ERR_CODE', 'Custom error', 400);
      expect(errRes.status).toBe(400);
      const errJson = await errRes.json();
      expect(errJson.success).toBe(false);
      expect(errJson.error.code).toBe('ERR_CODE');
    });
  });

  describe('Bounded Request Body Parser', () => {
    it('parses valid JSON within limits', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 123 }),
      });
      const parsed = await parseJsonBody<{ test: number }>(req, 1024);
      expect(parsed.test).toBe(123);
    });

    it('throws PayloadTooLargeError when exceeding byte limit', async () => {
      const largePayload = JSON.stringify({ data: 'x'.repeat(2000) });
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: largePayload,
      });

      await expect(parseJsonBody(req, 100)).rejects.toThrow(PayloadTooLargeError);
    });

    it('stops reading a chunked body without Content-Length once it exceeds the limit', async () => {
      let pulled = 0;
      const endless = new ReadableStream<Uint8Array>({
        pull(controller) {
          pulled++;
          controller.enqueue(new Uint8Array(64).fill(0x61));
        },
      });
      const req = new Request('http://localhost', {
        method: 'POST',
        body: endless,
        // @ts-expect-error duplex is required for streaming request bodies
        duplex: 'half',
      });
      expect(req.headers.get('content-length')).toBeNull();
      await expect(parseJsonBody(req, 256)).rejects.toThrow(PayloadTooLargeError);
      expect(pulled).toBeLessThan(10);
    });
  });

  describe('CORS Resolution & Security Headers', () => {
    it('grants wildcard origin to public crawler endpoints', () => {
      expect(resolveCorsOrigin('/dex/tokens', 'https://example.com')).toBe('*');
      expect(resolveCorsOrigin('/api/v1/pools', 'https://example.com')).toBe('*');
    });

    it('permits localhost origins in development mode', () => {
      expect(resolveCorsOrigin('/api/tokens', 'http://localhost:3010', [], false)).toBe(
        'http://localhost:3010',
      );
    });

    it('builds canonical security headers', () => {
      const headers = buildSecurityHeaders('http://localhost:3010');
      expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:3010');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
    });
  });

  describe('Rate Limit Tier Resolution', () => {
    it('assigns correct tier and request quotas', () => {
      expect(resolveRateLimitTier('/dex/tokens', 'GET')).toEqual({
        tier: 'crawler',
        maxRequests: 600,
      });
      expect(resolveRateLimitTier('/api/ipfs/upload', 'POST')).toEqual({
        tier: 'upload',
        maxRequests: 10,
      });
      expect(resolveRateLimitTier('/api/tokens/0x123', 'GET')).toEqual({
        tier: 'terminal',
        maxRequests: 600,
      });
      expect(resolveRateLimitTier('/api/other', 'POST')).toEqual({
        tier: 'api',
        maxRequests: 300,
      });
    });
  });
});
