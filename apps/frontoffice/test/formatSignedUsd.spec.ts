import { describe, expect, it } from 'vitest';
import { formatSignedUsd } from '../src/composables/usePnlShare';

describe('formatSignedUsd', () => {
  it('signs real gains and losses', () => {
    expect(formatSignedUsd(0.05)).toMatch(/^\+\$0\.05/);
    expect(formatSignedUsd(-12.4)).toMatch(/^-\$12\.4/);
  });

  it('shows an amount that rounds to zero without a sign', () => {
    for (const v of [0, -0, -0.0000001, 0.0000001]) {
      expect(formatSignedUsd(v)).toMatch(/^\$0/);
    }
  });
});
