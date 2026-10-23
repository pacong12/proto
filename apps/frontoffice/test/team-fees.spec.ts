import { describe, expect, it } from 'vitest';
import { planRecipients } from '../src/lib/team-fees';

const A = '0x00000000000000000000000000000000000000aa';
const B = '0x00000000000000000000000000000000000000bb';

describe('planRecipients', () => {
  it('defaults the first wallet to the creator and needs no team for one recipient', () => {
    expect(planRecipients([{ address: '', percent: 100 }], A)).toEqual({
      ok: true,
      payees: [A],
      sharesBps: [10_000],
      isTeam: false,
    });
  });

  it('builds a team with basis-point shares', () => {
    expect(
      planRecipients(
        [
          { address: '', percent: 62.5 },
          { address: B, percent: 37.5 },
        ],
        A,
      ),
    ).toEqual({ ok: true, payees: [A, B], sharesBps: [6_250, 3_750], isTeam: true });
  });

  it('rejects shares that do not add up, duplicates and bad addresses', () => {
    const r1 = planRecipients(
      [
        { address: '', percent: 60 },
        { address: B, percent: 30 },
      ],
      A,
    );
    expect(r1.ok).toBe(false);
    const r2 = planRecipients(
      [
        { address: A, percent: 50 },
        { address: A.toUpperCase().replace('0X', '0x'), percent: 50 },
      ],
      A,
    );
    expect(r2).toMatchObject({ ok: false, error: 'Wallet 2 is listed twice.' });
    expect(planRecipients([{ address: '0x12', percent: 100 }], A).ok).toBe(false);
  });
});
