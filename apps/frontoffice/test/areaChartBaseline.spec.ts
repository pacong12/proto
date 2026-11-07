// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { ShadcnAreaChart } from '../src/components/ui/chart';

describe('area chart', () => {
  it('never draws below its zero baseline after a spike', () => {
    const data = [0, 80, 100, 20, 0, 1, 2, 2, 1].map((value, i) => ({ label: `${i}`, value }));
    const height = 240;
    const wrapper = mount(ShadcnAreaChart, { props: { data, height } });
    const line = wrapper.findAll('path').find((p) => !p.attributes('d')?.includes('Z'));
    const ys = (line?.attributes('d') ?? '')
      .replace(/[MC,]/g, ' ')
      .trim()
      .split(/\s+/)
      .map(Number)
      .filter((_, i) => i % 2 === 1);
    const baseline = height - 36; // top padding + plot height
    expect(ys.length).toBeGreaterThan(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(baseline + 0.05);
  });
});
