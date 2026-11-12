import { describe, expect, it } from 'vitest';
import { SqliteTokenRepository } from '../src/app/storage/sqlite-token.repository';
import { server } from '../src/server';

const A = '0x00000000000000000000000000000000000000a1';
const B = '0x00000000000000000000000000000000000000b2';
const C = '0x00000000000000000000000000000000000000c3';

describe('SqliteReferralStore', () => {
  it('attributes first-touch and counts a referrer’s referees', async () => {
    const repo = new SqliteTokenRepository(':memory:');
    expect(await repo.recordReferral!(B, A, 1)).toBe(true);
    // B already has a referrer: a second attribution is ignored, A keeps the credit.
    expect(await repo.recordReferral!(B, C, 2)).toBe(false);
    expect(await repo.recordReferral!(C, A, 3)).toBe(true);
    expect(await repo.getReferrerOf!(B)).toBe(A.toLowerCase());
    const stats = await repo.getReferralStats!(A);
    expect(stats.count).toBe(2);
    expect(stats.referees.map((r) => r.referee).sort()).toEqual(
      [B.toLowerCase(), C.toLowerCase()].sort(),
    );
    repo.close();
  });
});

describe('referrals routes', () => {
  const post = (body: object) =>
    server.fetch(
      new Request('http://localhost:3001/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );

  it('records an attribution and rejects self-referral and bad input', async () => {
    const good = await (await post({ referee: B, referrer: A })).json();
    expect(good.success).toBe(true);

    const stats = await (
      await server.fetch(new Request(`http://localhost:3001/api/referrals?referrer=${A}`))
    ).json();
    expect(stats.data.count).toBeGreaterThanOrEqual(1);

    const self = await post({ referee: A, referrer: A });
    expect(self.status).toBe(400);
    const badAddr = await (await post({ referee: '0xZZZ', referrer: A })).json();
    expect(badAddr.error.code).toBe('INVALID_ADDRESS');
  });
});
