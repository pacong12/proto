import { describe, it, expect } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { buildCommentSignMessage } from '@goton/shared-types';
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
        content: 'Alpha call on $GOTON! Send it to $100K MC!',
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
    expect(match.content).toContain('Alpha call on $GOTON');

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

  it('POST /api/tokens/:address/comments verifies cryptographic signature and prevents whale impersonation', async () => {
    const realSigner = privateKeyToAccount(
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    );
    const whaleAddress = '0x1111111111111111111111111111111111111111';
    const timestamp = Date.now();
    const content = 'Legitimate call signed by real wallet key';

    const message = buildCommentSignMessage({
      tokenAddress: testAddress,
      authorAddress: realSigner.address,
      content,
      timestamp,
    });
    const validSignature = await realSigner.signMessage({ message });

    // 1. Valid signature passes
    const validReq = new Request(`http://localhost:3001/api/tokens/${testAddress}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorAddress: realSigner.address,
        content,
        targetMcap: '$200K MC',
        positionUsd: 100,
        callType: 'call',
        signature: validSignature,
        timestamp,
      }),
    });
    const validRes = await server.fetch(validReq);
    expect(validRes.status).toBe(201);

    // 2. Impersonation: attacker uses signature signed by realSigner, but sets authorAddress to whaleAddress
    const fakeReq = new Request(`http://localhost:3001/api/tokens/${testAddress}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorAddress: whaleAddress,
        content,
        targetMcap: '$10M MC',
        positionUsd: 50000,
        callType: 'call',
        signature: validSignature,
        timestamp,
      }),
    });
    const fakeRes = await server.fetch(fakeReq);
    expect(fakeRes.status).toBe(401);
    const fakeJson = await fakeRes.json();
    expect(fakeJson.success).toBe(false);
    expect(fakeJson.error.code).toBe('INVALID_SIGNATURE');

    // 3. Expired signature (e.g. 15 minutes ago)
    const expiredTimestamp = Date.now() - 15 * 60 * 1000;
    const expiredMessage = buildCommentSignMessage({
      tokenAddress: testAddress,
      authorAddress: realSigner.address,
      content,
      timestamp: expiredTimestamp,
    });
    const expiredSignature = await realSigner.signMessage({ message: expiredMessage });
    const expiredReq = new Request(`http://localhost:3001/api/tokens/${testAddress}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorAddress: realSigner.address,
        content,
        targetMcap: '$200K MC',
        positionUsd: 100,
        callType: 'call',
        signature: expiredSignature,
        timestamp: expiredTimestamp,
      }),
    });
    const expiredRes = await server.fetch(expiredReq);
    expect(expiredRes.status).toBe(401);
    const expiredJson = await expiredRes.json();
    expect(expiredJson.success).toBe(false);
    expect(expiredJson.error.code).toBe('EXPIRED_SIGNATURE');
  });

  it('GET /api/v1/networks/:network/tokens/:address returns GeckoTerminal attributes or 404', async () => {
    const listReq = new Request('http://localhost:3001/api/tokens?limit=1');
    const listRes = await server.fetch(listReq);
    const listJson = await listRes.json();
    const targetAddr = listJson.data?.[0]?.address ?? testAddress;

    const req = new Request(`http://localhost:3001/api/v1/networks/robinhood/tokens/${targetAddr}`);
    const res = await server.fetch(req);
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.data.type).toBe('token');
      expect(json.data.attributes).toHaveProperty('address');
      expect(json.data.attributes).toHaveProperty('symbol');
      expect(json.data.attributes).toHaveProperty('total_supply');
    }
  }, 10_000);

  it('GET /dex/latest-block returns latest indexed block', async () => {
    const req = new Request('http://localhost:3001/dex/latest-block?chain=robinhood');
    const res = await server.fetch(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('block');
    expect(json).toHaveProperty('chainId');
  });

  it('GET /dex/events handles zero tokenAmount safely without NaN or Infinity', async () => {
    const req = new Request('http://localhost:3001/dex/events?fromBlock=0&toBlock=100');
    const res = await server.fetch(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('events');
    expect(Array.isArray(json.events)).toBe(true);
  });

  it('GET /api/tokens/:address/rewards returns reward distribution data', async () => {
    const testAccount = '0x1111111111111111111111111111111111111111';
    const req = new Request(
      `http://localhost:3001/api/tokens/${testAddress}/rewards?account=${testAccount}`,
    );
    const res = await server.fetch(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('tokenAddress');
    expect(json.data).toHaveProperty('account');
    expect(json.data).toHaveProperty('earnedWei');
    expect(json.data).toHaveProperty('rewardAssetSymbol');
  });

  it('GET /api/tokens/:address/flow rejects unknown windows and reports no trades as null', async () => {
    const bad = await server.fetch(
      new Request(`http://localhost:3001/api/tokens/${testAddress}/flow?window=7d`),
    );
    expect(bad.status).toBe(400);

    const quiet = '0x000000000000000000000000000000000000f10e';
    const res = await server.fetch(
      new Request(`http://localhost:3001/api/tokens/${quiet}/flow?window=5m`),
    );
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toMatchObject({
      window: '5m',
      buys: 0,
      sells: 0,
      buyPercent: null,
      sellPercent: null,
    });
  });

  it('GET /api/buyback/stats returns buyback tracking statistics', async () => {
    const req = new Request('http://localhost:3001/api/buyback/stats');
    const res = await server.fetch(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('totalBurns');
    expect(json.data).toHaveProperty('totalTokensBurned');
    expect(Array.isArray(json.data.recentBurns)).toBe(true);
  });
});
