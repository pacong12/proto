import { describe, expect, it } from 'vitest';
import { server } from '../src/server';

/**
 * Rate limiting (own file: the in-memory counter is per client IP and per module instance).
 * The upload tier allows 10 requests per minute.
 */
describe('rate limiting', () => {
  it('answers 429 once a client exceeds the upload tier', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await server.fetch(
        new Request('http://localhost:3001/api/ipfs/upload', { method: 'POST', body: '' }),
      );
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10)).not.toContain(429);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });

  it('keeps health probes outside the limit', async () => {
    for (let i = 0; i < 20; i++) {
      const res = await server.fetch(new Request('http://localhost:3001/health'));
      expect(res.status).not.toBe(429);
    }
  });
});
