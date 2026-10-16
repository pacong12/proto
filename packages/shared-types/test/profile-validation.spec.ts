import { describe, expect, it } from 'vitest';
import { PROFILE_LIMITS, sanitizeCreatorProfile, type CreatorProfile } from '../src';

const ok = (input: Partial<CreatorProfile> & Record<string, unknown>) => {
  const result = sanitizeCreatorProfile(input);
  if (typeof result === 'string') throw new Error(`unexpected rejection: ${result}`);
  return result;
};

describe('creator profile validation', () => {
  it('keeps only the known fields (no mass assignment)', () => {
    const profile = ok({ displayName: 'Alice', isAdmin: true, verified: true } as never);
    expect(Object.keys(profile).sort()).toEqual(
      ['avatarUrl', 'bannerUrl', 'bio', 'displayName', 'telegram', 'twitter'].sort(),
    );
  });

  it('trims text and treats non-string values as empty', () => {
    const profile = ok({ displayName: '  Alice  ', bio: 42 as never, twitter: { x: 1 } as never });
    expect(profile.displayName).toBe('Alice');
    expect(profile.bio).toBe('');
    expect(profile.twitter).toBe('');
  });

  it('enforces the length limits', () => {
    expect(ok({ displayName: 'a'.repeat(PROFILE_LIMITS.displayName) }).displayName).toHaveLength(
      PROFILE_LIMITS.displayName,
    );
    expect(
      sanitizeCreatorProfile({ displayName: 'a'.repeat(PROFILE_LIMITS.displayName + 1) }),
    ).toMatch(/displayName is longer/);
    expect(sanitizeCreatorProfile({ bio: 'b'.repeat(PROFILE_LIMITS.bio + 1) })).toMatch(/bio/);
    expect(
      sanitizeCreatorProfile({ avatarUrl: `https://x.io/${'a'.repeat(PROFILE_LIMITS.url)}` }),
    ).toMatch(/avatarUrl/);
  });

  it('accepts https, ipfs and API IPFS image URLs only', () => {
    for (const url of ['https://img.example/a.png', 'ipfs://bafkreiabc', '/api/ipfs/bafkreiabc']) {
      expect(ok({ avatarUrl: url }).avatarUrl).toBe(url);
    }
    for (const url of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'http://insecure.example/a.png',
      '//evil.example/a.png',
      'blob:https://x/1',
      'vbscript:msgbox(1)',
    ]) {
      expect(sanitizeCreatorProfile({ bannerUrl: url }), url).toMatch(/bannerUrl must be/);
    }
  });

  it('strips control and bidirectional-override characters used for spoofing', () => {
    const profile = ok({
      displayName: 'Ali‮ecnab‬',
      bio: 'line1\u0000\u0007line2​end',
      telegram: '⁦handle⁩',
    });
    expect(profile.displayName).toBe('Aliecnab');
    expect(profile.bio).toBe('line1line2end');
    expect(profile.telegram).toBe('handle');
  });

  it('keeps ordinary newlines and non-Latin scripts in the bio', () => {
    const bio = 'gm 👋\nこんにちは\nمرحبا';
    expect(ok({ bio }).bio).toBe(bio);
  });
});
