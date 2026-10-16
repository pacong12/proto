import { describe, it, expect } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { sanitizeCreatorProfile } from '@goton/shared-types';
import { createSessionToken } from '../src/core/auth/session';
import { server } from '../src/server';

const owner = privateKeyToAccount(
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
);
const other = '0x2222222222222222222222222222222222222222';

const profile = {
  displayName: 'Goton Dev',
  bio: 'Building on Arc and Robinhood',
  avatarUrl: 'ipfs://bafkreiexample',
  bannerUrl: 'https://example.com/banner.png',
  twitter: 'protodev',
  telegram: 'protodev',
};

function put(address: string, body: unknown, sessionFor?: string) {
  return server.fetch(
    new Request(`http://localhost:3001/api/profiles/${address}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionFor ? { Authorization: `Bearer ${createSessionToken(sessionFor).token}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

describe('Creator profiles (FO-10)', () => {
  it('stores a profile for its owner and serves it to everyone', async () => {
    expect((await put(owner.address, profile, owner.address)).status).toBe(200);
    const res = await server.fetch(
      new Request(`http://localhost:3001/api/profiles/${owner.address}`),
    );
    const json = await res.json();
    expect(json.data.profile).toEqual(profile);
  });

  it('refuses writes from another wallet session', async () => {
    expect((await put(owner.address, profile, other)).status).toBe(403);
  });

  it('rejects unsafe or oversized fields', async () => {
    expect(
      (await put(owner.address, { ...profile, avatarUrl: 'javascript:alert(1)' }, owner.address))
        .status,
    ).toBe(400);
    expect(
      (await put(owner.address, { ...profile, bio: 'x'.repeat(281) }, owner.address)).status,
    ).toBe(400);
  });

  it('sanitizer trims fields and blocks data:/blob: images', () => {
    expect(sanitizeCreatorProfile({ displayName: '  A  ' })).toMatchObject({
      displayName: 'A',
      bio: '',
    });
    expect(typeof sanitizeCreatorProfile({ avatarUrl: 'data:image/png;base64,AAAA' })).toBe(
      'string',
    );
    expect(typeof sanitizeCreatorProfile({ bannerUrl: 'blob:https://x/y' })).toBe('string');
  });
});
