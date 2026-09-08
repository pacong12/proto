import { describe, it, expect } from 'vitest';
import { server } from '../src/server';

describe('Tokens HTTP Endpoints Integration', () => {
  const testAddress = '0x1111111111111111111111111111111111111111';

  it('GET /api/tokens/:address/holders returns 200 with holders distribution', async () => {
    const req = new Request(`http://localhost:3001/api/tokens/${testAddress}/holders?limit=10`);
    const res = await server.fetch(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(2);

    const first = json.data[0];
    expect(first).toHaveProperty('address');
    expect(first).toHaveProperty('balance');
    expect(first).toHaveProperty('percent');
  });

  it('GET /api/tokens/:address/trades returns 200 with pagination support', async () => {
    const req = new Request(
      `http://localhost:3001/api/tokens/${testAddress}/trades?limit=5&offset=0`,
    );
    const res = await server.fetch(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('GET /api/tokens/invalid-address/holders returns 404', async () => {
    const req = new Request('http://localhost:3001/api/tokens/not-an-address/holders');
    const res = await server.fetch(req);

    expect(res.status).toBe(404);
  });
});
