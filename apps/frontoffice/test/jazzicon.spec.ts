import { describe, it, expect } from 'vitest';
import { generateJazzicon } from '../src/lib/jazzicon';

describe('Jazzicon Generator', () => {
  it('generates consistent SVG markup for a given address', () => {
    const address = '0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2';
    const icon1 = generateJazzicon(address);
    const icon2 = generateJazzicon(address);

    expect(icon1.backgroundColor).toBe(icon2.backgroundColor);
    expect(icon1.shapes.length).toBe(icon2.shapes.length);
    expect(icon1.shapes.length).toBeGreaterThan(0);
    expect(icon1.shapes[0].fill).toBe(icon2.shapes[0].fill);
  });

  it('generates different colors and shapes for different addresses', () => {
    const addrA = '0x1111111111111111111111111111111111111111';
    const addrB = '0x2222222222222222222222222222222222222222';

    const iconA = generateJazzicon(addrA);
    const iconB = generateJazzicon(addrB);

    // Shapes or background should differ
    const areIdentical =
      iconA.backgroundColor === iconB.backgroundColor &&
      iconA.shapes.every((s, i) => s.fill === iconB.shapes[i]?.fill);

    expect(areIdentical).toBe(false);
  });

  it('handles lowercase, uppercase, and mixed-case addresses deterministically', () => {
    const mixed = '0x555c0456641D5fF4fB47e24d6472b4A16AC1B0C2';
    const lower = mixed.toLowerCase();

    const iconMixed = generateJazzicon(mixed);
    const iconLower = generateJazzicon(lower);

    expect(iconMixed.backgroundColor).toBe(iconLower.backgroundColor);
    expect(iconMixed.shapes.length).toBe(iconLower.shapes.length);
  });
});
