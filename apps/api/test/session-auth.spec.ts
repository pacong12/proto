import { describe, it, expect } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { buildSessionSignMessage, SESSION_TTL_MS } from '@goton/shared-types';
import { createSessionToken, verifySessionToken } from '../src/core/auth/session';
import { server } from '../src/server';

const signer = privateKeyToAccount(
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
);
const other = '0x2222222222222222222222222222222222222222';

async function openSession(issuedAt = Date.now(), address: string = signer.address) {
  const signature = await signer.signMessage({
    message: buildSessionSignMessage({ address: signer.address, issuedAt }),
  });
  return server.fetch(
    new Request('http://localhost:3001/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, issuedAt, signature }),
    }),
  );
}

describe('Wallet sessions for social actions (API-09)', () => {
  it('issues tokens bound to an address and rejects tampering or expiry', () => {
    const now = Date.now();
    const { token, expiresAt } = createSessionToken(signer.address, now);
    expect(expiresAt).toBe(now + SESSION_TTL_MS);
    expect(verifySessionToken(token, now)).toBe(signer.address.toLowerCase());

    const [payload, mac] = token.split('.');
    const forged = Buffer.from(`${other}.${expiresAt}`).toString('base64url');
    expect(verifySessionToken(`${forged}.${mac}`, now)).toBeNull();
    expect(verifySessionToken(`${payload}.${mac}x`, now)).toBeNull();
    expect(verifySessionToken(token, expiresAt + 1)).toBeNull();
  });

  it('exchanges a fresh wallet signature for a session token', async () => {
    const res = await openSession();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(verifySessionToken(json.data.token)).toBe(signer.address.toLowerCase());
  });

  it('rejects signatures for another address or stale sign-in messages', async () => {
    expect((await openSession(Date.now(), other)).status).toBe(401);
    expect((await openSession(Date.now() - 11 * 60 * 1000)).status).toBe(401);
  });

  it('refuses a like attributed to a different wallet than the session', async () => {
    const { token } = createSessionToken(signer.address);
    const like = (userAddress: string) =>
      server.fetch(
        new Request('http://localhost:3001/api/comments/some-comment/like', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userAddress }),
        }),
      );
    expect((await like(other)).status).toBe(403);
    expect((await like(signer.address)).status).toBe(200);
  });
});
