import { describe, expect, it } from 'vitest';
import { buildIdentityIndex, getUserIdentity } from '../src';

// Same name (each 16-bit chunk is 0 mod 64), different tags.
const A = '0x000000000000000000000000000000000000aaaa';
const B = '0x004000400040000000000000000000000000bbbb';
// Same tag as A, another name.
const C = '0x000100010001000000000000000000000000aaaa';

describe('buildIdentityIndex', () => {
  it('gives two wallets of one name the same bare name and different slugs', () => {
    expect(getUserIdentity(A).name).toBe(getUserIdentity(B).name);
    expect(getUserIdentity(A).slug).not.toBe(getUserIdentity(B).slug);
    expect(getUserIdentity(A).tag).toBe(getUserIdentity(C).tag);
  });

  it('resolves names that carry the tag, and a bare name or tag only while it is unique', () => {
    const solo = buildIdentityIndex([A]);
    expect(solo.get(getUserIdentity(A).name.toLowerCase())).toBe(A);
    expect(solo.get('aaaa')).toBe(A);

    const index = buildIdentityIndex([A, B, C, A.toUpperCase().replace('0X', '0x')]);
    for (const addr of [A, B, C]) {
      const id = getUserIdentity(addr);
      expect(index.get(id.slug)).toBe(addr);
      expect(index.get(id.displayName.toLowerCase())).toBe(addr);
      expect(index.get(id.handle.toLowerCase())).toBe(addr);
    }
    expect(index.has(getUserIdentity(A).name.toLowerCase())).toBe(false);
    expect(index.has('aaaa')).toBe(false);
    expect(index.get(getUserIdentity(C).name.toLowerCase())).toBe(C);
  });
});
