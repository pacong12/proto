import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { mergeCandles, patchLivePrice, replaceIfChanged } from '@/composables/trade/useTradeMarket';

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

  it('drops live bars the stream drew before their trade was indexed', () => {
    // Live bars at 9 and 10 for a move whose trade the API files at 8.
    const existing = [bar(5, 10, 1), bar(9, 13), bar(10, 13)];
    const incoming = [bar(5, 10, 1), bar(8, 13, 2)];
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

describe('patchLivePrice', () => {
  it('moves the open candle to the live price', () => {
    const rows = [bar(60, 10), bar(120, 10)];
    patchLivePrice(rows, 13, 60, 150);
    expect(rows[1]).toEqual({ time: 120, open: 10, high: 13, low: 10, close: 13, volume: 0 });
  });

  it('opens a new candle from the last close when the price moved, and none when it did not', () => {
    const rows = [bar(60, 10)];
    patchLivePrice(rows, 10, 60, 200);
    expect(rows).toHaveLength(1);
    patchLivePrice(rows, 8, 60, 200);
    expect(rows[1]).toEqual({ time: 180, open: 10, high: 10, low: 8, close: 8, volume: 0 });
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
