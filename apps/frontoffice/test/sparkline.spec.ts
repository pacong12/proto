import { describe, expect, it } from 'vitest';
import { sparklinePath } from '../src/lib/sparkline';

describe('sparklinePath', () => {
  it('draws a level grey line for a quiet token', () => {
    expect(sparklinePath([5, 5, 5, 5], 72, 24)).toEqual({ d: 'M 0 12 L 72 12', trend: 'flat' });
    expect(sparklinePath(undefined, 72, 24).trend).toBe('flat');
    expect(sparklinePath([5], 72, 24).trend).toBe('flat');
  });

  it('follows the data and colors by the window change', () => {
    const up = sparklinePath([1, 3, 2, 4], 30, 24);
    expect(up.trend).toBe('up');
    expect(up.d.startsWith('M 0.0 22.0')).toBe(true); // lowest point at the bottom
    expect(up.d.endsWith('L 30.0 2.0')).toBe(true); // highest point at the top
    expect(sparklinePath([4, 1, 2], 30, 24).trend).toBe('down');
  });
});
