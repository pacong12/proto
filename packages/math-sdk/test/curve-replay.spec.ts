import { describe, expect, it } from 'vitest';
import {
  getAmountOutBuyWei,
  getAmountOutSellWei,
  replayCurveReserves,
  type CurveReserves,
  type CurveTradeAmounts,
} from '../src/bonding-curve';

const LAUNCH: CurveReserves = {
  virtualEthWei: 1_680_000_000_000_000_000n,
  virtualTokenWei: 10n ** 27n,
};
const ETH = 10n ** 18n;

/** The curve as BondingCurve.sol runs it, emitting the Trade event's amounts. */
function simulate(steps: Array<{ buyEth?: bigint; sellTokens?: bigint }>) {
  let { virtualEthWei: eth, virtualTokenWei: tokens } = LAUNCH;
  const events: CurveTradeAmounts[] = [];
  for (const s of steps) {
    if (s.buyEth) {
      const { tokenOutWei, feeEthWei } = getAmountOutBuyWei(s.buyEth, eth, tokens);
      eth += s.buyEth - feeEthWei;
      tokens -= tokenOutWei;
      events.push({
        isBuy: true,
        ethAmount: s.buyEth,
        tokenAmount: tokenOutWei,
        feeEth: feeEthWei,
      });
    } else if (s.sellTokens) {
      const { ethOutWei, feeEthWei } = getAmountOutSellWei(s.sellTokens, eth, tokens);
      tokens += s.sellTokens;
      eth -= ethOutWei + feeEthWei;
      events.push({
        isBuy: false,
        ethAmount: ethOutWei,
        tokenAmount: s.sellTokens,
        feeEth: feeEthWei,
      });
    }
  }
  return { events, final: { virtualEthWei: eth, virtualTokenWei: tokens } };
}

/** a and b within a relative 1e-18 (the replay's token side may be off by a wei or so). */
const near = (a: bigint, b: bigint) => {
  const diff = a > b ? a - b : b - a;
  return diff * 10n ** 18n <= b;
};

describe('replayCurveReserves', () => {
  it("walks back to the launch reserves through each trade's reserves", () => {
    const steps = [
      { buyEth: ETH / 2n },
      { buyEth: 3n * ETH },
      { sellTokens: 50_000_000n * ETH },
      { buyEth: ETH / 100_000n },
      { sellTokens: 1_000n * ETH },
    ];
    const { events, final } = simulate(steps);
    const replay = replayCurveReserves(final, events);
    expect(replay.launch.virtualEthWei).toBe(LAUNCH.virtualEthWei);
    expect(near(replay.launch.virtualTokenWei, LAUNCH.virtualTokenWei)).toBe(true);
    expect(replay.after.at(-1)).toEqual(final);
    // Each step's reserves match a forward simulation of the trades up to it.
    for (let i = 0; i < steps.length; i++) {
      const upTo = simulate(steps.slice(0, i + 1)).final;
      expect(replay.after[i]!.virtualEthWei).toBe(upTo.virtualEthWei);
      expect(near(replay.after[i]!.virtualTokenWei, upTo.virtualTokenWei)).toBe(true);
    }
    const spots = replay.after.map((r) => Number(r.virtualEthWei) / Number(r.virtualTokenWei));
    const moves = spots.slice(1).map((s, i) => Math.sign(s - spots[i]!));
    expect(moves).toEqual([1, -1, 1, -1]);
  });

  it('counts only the tokens a taxed sell left in the curve', () => {
    const sold: CurveTradeAmounts = { isBuy: false, ethAmount: 0n, tokenAmount: 1000n, feeEth: 0n };
    const { launch } = replayCurveReserves(LAUNCH, [sold], 500n);
    expect(LAUNCH.virtualTokenWei - launch.virtualTokenWei).toBe(950n);
  });
});
