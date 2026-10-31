import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { mergeCandles, replaceIfChanged } from '@/composables/trade/useTradeMarket';

const bar = (time: number, close: number, volume = 0) => ({
  time,
  open: close,
  high: close,
  low: close,
  close,
  volume,
});

describe('mergeCandles', () => {
  it('takes a trade indexed after its bar was no longer among the last ones', () => {
    const existing = [bar(1, 10), bar(2, 10), bar(3, 10), bar(4, 10)];
    // The buy landed in bar 2, seen only after bars 3 and 4 were drawn.
    const incoming = [bar(1, 10), bar(2, 12, 0.5), bar(3, 12), bar(4, 12), bar(5, 12)];
    expect(mergeCandles(existing, incoming)).toEqual(incoming);
  });

  it('keeps the bars in time order and reports no change as null', () => {
    const existing = [bar(1, 10), bar(3, 11)];
    expect(mergeCandles(existing, [bar(2, 10.5), bar(3, 11)])?.map((b) => b.time)).toEqual([
      1, 2, 3,
    ]);
    expect(mergeCandles(existing, [bar(3, 11)])).toBeNull();
  });
});

describe('replaceIfChanged', () => {
  it('updates a full list whose length and first row stay the same', () => {
    // 50 holders, the same top holder: only a balance further down moved.
    const holders = ref([
      { address: '0xa', balance: '100' },
      { address: '0xb', balance: '50' },
    ]);
    const before = holders.value;
    replaceIfChanged(holders, [
      { address: '0xa', balance: '100' },
      { address: '0xb', balance: '70' },
    ]);
    expect(holders.value[1]?.balance).toBe('70');
    // Identical content keeps the same array, so nothing re-renders.
    const same = holders.value;
    replaceIfChanged(holders, JSON.parse(JSON.stringify(same)));
    expect(holders.value).toBe(same);
    expect(before).not.toBe(same);
  });
});
