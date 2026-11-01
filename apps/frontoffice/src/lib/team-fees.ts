import { isAddress } from '@goton/shared-types';

/** One line of the create page's fee recipient list. A blank first address means the creator. */
export interface FeeRecipientRow {
  address: string;
  percent: number;
}

/** GotonTeamSplitter accepts at most this many payees. */
export const MAX_TEAM_PAYEES = 10;

export type RecipientPlan =
  | { ok: true; payees: `0x${string}`[]; sharesBps: number[]; isTeam: boolean }
  | { ok: false; error: string };

/**
 * Turns the recipient rows into GotonTeamSplitter payees and basis-point shares (summing to
 * 10,000). One row is a plain recipient (no team contract); the first row's blank address is the
 * connected wallet.
 */
export function planRecipients(rows: FeeRecipientRow[], creator?: string | null): RecipientPlan {
  if (rows.length === 0) return { ok: false, error: 'Add at least one fee recipient.' };
  if (rows.length > MAX_TEAM_PAYEES) {
    return { ok: false, error: `A team can have at most ${MAX_TEAM_PAYEES} wallets.` };
  }
  const payees: `0x${string}`[] = [];
  const sharesBps: number[] = [];
  for (const [i, row] of rows.entries()) {
    const address = (row.address.trim() || (i === 0 ? (creator ?? '') : '')).trim();
    if (!isAddress(address)) return { ok: false, error: `Wallet ${i + 1} is not a valid address.` };
    if (payees.some((p) => p.toLowerCase() === address.toLowerCase())) {
      return { ok: false, error: `Wallet ${i + 1} is listed twice.` };
    }
    const bps = Math.round(Number(row.percent) * 100);
    if (!(bps > 0)) return { ok: false, error: `Wallet ${i + 1} needs a share above 0%.` };
    payees.push(address);
    sharesBps.push(bps);
  }
  const total = sharesBps.reduce((a, b) => a + b, 0);
  if (total !== 10_000) {
    return { ok: false, error: `Shares add up to ${total / 100}%; they must add up to 100%.` };
  }
  return { ok: true, payees, sharesBps, isTeam: payees.length > 1 };
}
