import { describe, expect, it } from 'vitest';
import { launchRequirements } from '../src/lib/launch-requirements';

const arc = { launchFee: 0, minPrebuy: 4.5, taxRequired: true };
const robinhood = { launchFee: 0.0005, minPrebuy: 0, taxRequired: false };

describe('launchRequirements', () => {
  it('charges the required pre-buy when the field is empty, and blocks the launch', () => {
    const r = launchRequirements({ ...arc, initialBuy: '', buyTax: '1', sellTax: '0' });
    expect(r.prebuyTooLow).toBe(true);
    expect(r.effectiveBuy).toBe(4.5);
    expect(r.totalDue).toBe(4.5);
    expect(r.blocked).toBe(true);
  });

  it('accepts exactly the minimum, and more', () => {
    for (const initialBuy of ['4.50', 4.5, '10']) {
      const r = launchRequirements({ ...arc, initialBuy, buyTax: '0', sellTax: '2' });
      expect(r.prebuyTooLow).toBe(false);
      expect(r.blocked).toBe(false);
    }
    expect(
      launchRequirements({ ...arc, initialBuy: '10', buyTax: '1', sellTax: '0' }).totalDue,
    ).toBe(10);
  });

  it('needs one tax above 0% where the chain requires it', () => {
    const none = launchRequirements({ ...arc, initialBuy: '5', buyTax: '0', sellTax: '0' });
    expect(none.taxMissing).toBe(true);
    expect(none.blocked).toBe(true);
    const empty = launchRequirements({ ...arc, initialBuy: '5', buyTax: '', sellTax: '' });
    expect(empty.taxMissing).toBe(true);
    const sell = launchRequirements({ ...arc, initialBuy: '5', buyTax: '0', sellTax: '0.5' });
    expect(sell.taxMissing).toBe(false);
  });

  it('asks nothing of a chain without those rules, and adds its launch fee', () => {
    const r = launchRequirements({ ...robinhood, initialBuy: '', buyTax: '0', sellTax: '0' });
    expect(r.blocked).toBe(false);
    expect(r.totalDue).toBe(0.0005);
    expect(
      launchRequirements({ ...robinhood, initialBuy: '0.01', buyTax: '0', sellTax: '0' }).totalDue,
    ).toBeCloseTo(0.0105);
  });
});
