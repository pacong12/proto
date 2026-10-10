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
    expect(json.data.length).toBeGreaterThanOrEqual(1);

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

  it('GET /api/tokens/:address/top-traders returns 200 with ranking fields', async () => {
    const req = new Request(`http://localhost:3001/api/tokens/${testAddress}/top-traders?limit=10`);
    const res = await server.fetch(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('GET /api/tokens/:address/dev-activity returns 200 with developer metrics', async () => {
    const req = new Request(`http://localhost:3001/api/tokens/${testAddress}/dev-activity`);
    const res = await server.fetch(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('creatorAddress');
    expect(json.data).toHaveProperty('creatorStatus');
    expect(json.data).toHaveProperty('currentHoldPercent');
  });

  it('GET /api/tokens supports deployer filter parameter', async () => {
    const req = new Request(
      'http://localhost:3001/api/tokens?deployer=0x1111111111111111111111111111111111111111',
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

  it('GET /api/trades returns 200 with global recent trades list', async () => {
    const req = new Request('http://localhost:3001/api/trades?limit=10');
    const res = await server.fetch(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('GET /api/trades?trader= returns 200 with filtered trades by trader', async () => {
    const traderAddr = '0x1111111111111111111111111111111111111111';
    const req = new Request(`http://localhost:3001/api/trades?trader=${traderAddr}&limit=10`);
    const res = await server.fetch(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('GET /api/trades?trader= returns 400 for invalid address', async () => {
    const req = new Request('http://localhost:3001/api/trades?trader=invalid-addr');
    const res = await server.fetch(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INVALID_PARAM');
  });

  it('GET /api/trades/:txHash returns 404 for non-existent transaction hash', async () => {
    const nonExistentHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const req = new Request(`http://localhost:3001/api/trades/${nonExistentHash}`);
    const res = await server.fetch(req);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('POST /api/tokens/:address/comments creates a callout and GET /api/feed returns it', async () => {
    const author = '0x2222222222222222222222222222222222222222';
    const postReq = new Request(`http://localhost:3001/api/tokens/${testAddress}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorAddress: author,
        content: 'Alpha call on $PROTO! Send it to $100K MC!',
        targetMcap: '$100K MC',
        positionUsd: 150.25,
        callType: 'call',
      }),
    });
    const postRes = await server.fetch(postReq);
    expect(postRes.status).toBe(201);
    const postJson = await postRes.json();
    expect(postJson.success).toBe(true);
    expect(postJson.data.targetMcap).toBe('$100K MC');
    expect(postJson.data.positionUsd).toBe(150.25);
    expect(postJson.data.callType).toBe('call');

    // Test GET /api/feed
    const feedReq = new Request('http://localhost:3001/api/feed?limit=10');
    const feedRes = await server.fetch(feedReq);
    expect(feedRes.status).toBe(200);
    const feedJson = await feedRes.json();
    expect(feedJson.success).toBe(true);
    expect(Array.isArray(feedJson.data)).toBe(true);
    expect(feedJson.data.length).toBeGreaterThanOrEqual(1);

    const match = feedJson.data.find((c: { id: string }) => c.id === postJson.data.id);
    expect(match).toBeDefined();
    expect(match.content).toContain('Alpha call on $PROTO');

    // Test GET /api/callouts alias
    const calloutsReq = new Request('http://localhost:3001/api/callouts?limit=5');
    const calloutsRes = await server.fetch(calloutsReq);
    expect(calloutsRes.status).toBe(200);
  });

  it('POST /api/tokens/:address/comments rejects callouts when caller holds no position', async () => {
    const nonHolder = '0x9999999999999999999999999999999999999999';
    const req = new Request(`http://localhost:3001/api/tokens/${testAddress}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorAddress: nonHolder,
        content: 'I have no coins but I am calling it anyway',
        callType: 'call',
        positionUsd: 0,
      }),
    });
    const res = await server.fetch(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('NO_TOKEN_POSITION');
  });
});
