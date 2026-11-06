import { describe, expect, it } from 'vitest';
import { holderPosition } from '../src/modules/social/application/holder-position';

describe('holderPosition', () => {
  it('scales a raw indexed balance by the token decimals before pricing it', () => {
    // 180,976,752.98 tokens of 18 decimals at $0.0026 (was priced as 1.8e26 tokens: $4.7e23).
    const p = holderPosition(
      { balance: '180976752982768403251069132', percent: 18.09 },
      18,
      0.0026,
    );
    expect(p!.tokens).toBeCloseTo(180_976_752.98, 1);
    expect(p!.usd).toBeCloseTo(470_539.56, 1);
    expect(p!.supplyPercent).toBe(18.09);
  });

  it('honours other decimals', () => {
    expect(holderPosition({ balance: '2500000', percent: 1 }, 6, 2)!.usd).toBe(5);
  });

  it('has no position for an empty or unreadable balance', () => {
    expect(holderPosition({ balance: '0', percent: 0 }, 18, 1)).toBeNull();
    expect(holderPosition({ balance: '12.5', percent: 0 }, 18, 1)).toBeNull();
  });

  it('values a position at 0 while the price is unknown', () => {
    expect(holderPosition({ balance: '1000000000000000000', percent: 0 }, 18, 0)!.usd).toBe(0);
  });
});
