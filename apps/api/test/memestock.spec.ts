import { describe, expect, it } from 'vitest';
import type { TradeEventEntity } from '@goton/shared-types';
import {
  hasThesis,
  isMemestock,
  memestockSignals,
} from '../src/modules/tokens/application/memestock';

const NOW = 1_800_000_000_000;
const CREATOR = '0x00000000000000000000000000000000000000c1' as const;
const OTHER = '0x00000000000000000000000000000000000000d2' as const;
const token = { deployer: CREATOR, totalSupply: (10n ** 27n).toString(), decimals: 18 };

function trade(
  trader: `0x${string}`,
  isBuy: boolean,
  tokens: number,
  quote: number,
  agoMs: number,
): TradeEventEntity {
  return {
    id: `${trader}-${agoMs}`,
    tokenAddress: '0x00000000000000000000000000000000000000aa',
    poolAddress: '0x00000000000000000000000000000000000000aa',
    trader,
    isBuy,
    tokenAmount: String(tokens),
    wethAmount: String(quote),
    priceUsd: 0,
    blockNumber: 1n,
    transactionHash: '0x0',
    timestamp: NOW - agoMs,
  };
}

describe('memestock', () => {
  it('needs a written thesis, not a default or keyboard mash', () => {
    expect(hasThesis('')).toBe(false);
    expect(hasThesis('A HAT FROM ROBINHOOD')).toBe(true);
    expect(hasThesis('aspdasdkas;dka;sldk;asdkl;sadasdd')).toBe(false);
    expect(hasThesis('moon')).toBe(false);
  });

  it('measures the creator position and recent momentum', () => {
    const s = memestockSignals(
      token,
      [
        trade(CREATOR, true, 10_000_000, 0.01, 3 * 86_400_000), // creator buy, days ago
        trade(OTHER, true, 1_000, 0.3, 600_000), // 10 min ago
        trade(CREATOR, false, 2_000_000, 0.1, 1_200_000), // creator sells 20%
      ],
      NOW,
    );
    expect(s.creatorBought).toBe(10_000_000);
    expect(s.creatorSold).toBe(2_000_000);
    expect(s.creatorHoldsPct).toBeCloseTo(0.8, 6); // 8M of 1B
    expect(s.traders1h).toBe(2);
    expect(s.buyPressure1h).toBeCloseTo(0.75, 6); // 0.3 buy vs 0.1 sell
  });

  it('drops launches whose creator never bought or sold most of it', () => {
    const desc = 'A community coin for people who love hats';
    const none = memestockSignals(token, [trade(OTHER, true, 1, 0.1, 1)], NOW);
    expect(isMemestock(desc, none)).toBe(false);
    const dumped = memestockSignals(
      token,
      [trade(CREATOR, true, 100, 0.1, 10), trade(CREATOR, false, 60, 0.1, 5)],
      NOW,
    );
    expect(isMemestock(desc, dumped)).toBe(false);
    const holding = memestockSignals(token, [trade(CREATOR, true, 100, 0.1, 10)], NOW);
    expect(isMemestock(desc, holding)).toBe(true);
    expect(isMemestock('gm', holding)).toBe(false);
  });
});
