import { describe, expect, it } from 'vitest';
import type { PublicClient } from 'viem';
import { ROBINHOOD_CHAIN, readCreatorFees } from '../src';

const SPLITTER = '0x00000000000000000000000000000000000000f1';
const CREATOR = '0x00000000000000000000000000000000000000c1';
const TOKEN = '0x00000000000000000000000000000000000000aa';

/** A graduated Robinhood token: 0.02 ETH in the splitter for the creator, fees still uncollected. */
function client(lpFees: bigint | Error, tax: bigint | Error) {
  const reads: Record<string, unknown> = {
    graduations: [SPLITTER],
    quoteAsset: '0x0000000000000000000000000000000000000000',
    creatorAccrued: 2n * 10n ** 16n,
    protocolBps: 2000,
    creatorBps: 2500,
    creatorRecipient: CREATOR,
    creator: CREATOR,
  };
  return {
    readContract: async ({ functionName }: { functionName: string }) => {
      if (functionName === 'pendingTax') {
        if (tax instanceof Error) throw tax;
        return tax;
      }
      return reads[functionName];
    },
    simulateContract: async () => {
      if (lpFees instanceof Error) throw lpFees;
      return { result: [lpFees, 5n] };
    },
  } as unknown as PublicClient;
}

describe('readCreatorFees', () => {
  it("adds the creator's share of uncollected LP fees and held tax to what is claimable", async () => {
    // 1 ETH of LP fees + 0.6 ETH of held tax: 20% protocol off the top, 25% of the rest.
    const fees = await readCreatorFees(client(10n ** 18n, 6n * 10n ** 17n), ROBINHOOD_CHAIN, TOKEN);
    expect(fees?.accrued).toBe(2n * 10n ** 16n);
    expect(fees?.pending).toBe(32n * 10n ** 16n); // 1.6 x 0.8 x 0.25
    expect(fees?.creator).toBe(CREATOR);
  });

  it('reads 0 pending when nothing can be collected (first hook, nothing in the pool)', async () => {
    const fees = await readCreatorFees(
      client(new Error('UnknownToken()'), new Error('no pendingTax')),
      ROBINHOOD_CHAIN,
      TOKEN,
    );
    expect(fees?.pending).toBe(0n);
    expect(fees?.accrued).toBe(2n * 10n ** 16n);
  });
});
