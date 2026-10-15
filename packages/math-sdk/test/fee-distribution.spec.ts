import { describe, it, expect } from 'vitest';
import {
  calculateFeeSplit,
  calculateLockerFeeSplit,
  calculateHolderReward,
  calculateEffectiveBalance,
} from '../src/fee-distribution';

describe('Math SDK - Fee Distribution', () => {
  describe('calculateLockerFeeSplit (LiquidityLocker.sol 70/30 Split)', () => {
    it('splits fee into 70% creator and 30% protocol', () => {
      const totalFee = 1000000000000000000n; // 1 ETH
      const split = calculateLockerFeeSplit(totalFee);
      expect(split.creatorFeeWei).toBe(700000000000000000n); // 0.7 ETH
      expect(split.protocolFeeWei).toBe(300000000000000000n); // 0.3 ETH
      expect(split.creatorFeeWei + split.protocolFeeWei).toBe(totalFee);
    });

    it('returns zero for zero input', () => {
      const split = calculateLockerFeeSplit(0n);
      expect(split.creatorFeeWei).toBe(0n);
      expect(split.protocolFeeWei).toBe(0n);
    });
  });

  describe('calculateFeeSplit (70/20/10 Protocol Split)', () => {
    it('returns zero for zero fee input', () => {
      const split = calculateFeeSplit(0n);
      expect(split.creatorFeeWei).toBe(0n);
      expect(split.holderFeeWei).toBe(0n);
      expect(split.buybackFeeWei).toBe(0n);
    });

    it('splits fee exactly into 70% creator, 20% holders, 10% buyback with zero wei residue leakage', () => {
      const totalFee = 1000000000000000000n; // 1 ETH fee
      const split = calculateFeeSplit(totalFee);

      // 70% = 0.7 ETH
      expect(split.creatorFeeWei).toBe(700000000000000000n);
      // 20% = 0.2 ETH
      expect(split.holderFeeWei).toBe(200000000000000000n);
      // 10% = 0.1 ETH
      expect(split.buybackFeeWei).toBe(100000000000000000n);

      // Invariant: sum of pieces equals exact original total fee (no wei lost in division)
      expect(split.creatorFeeWei + split.holderFeeWei + split.buybackFeeWei).toBe(totalFee);
    });

    it('guarantees zero wei loss even on indivisible amounts', () => {
      const oddFee = 123456789123456789n;
      const split = calculateFeeSplit(oddFee);
      expect(split.creatorFeeWei + split.holderFeeWei + split.buybackFeeWei).toBe(oddFee);
    });
  });

  describe('calculateHolderReward', () => {
    it('computes pro-rata dividend based on supply ownership', () => {
      const totalSupply = 1_000_000_000n * 10n ** 18n; // 1B tokens
      const holderBalance = 50_000_000n * 10n ** 18n; // 50M tokens (5%)
      const rewardPool = 2n * 10n ** 18n; // 2 ETH in pool

      // 5% of 2 ETH = 0.1 ETH
      const reward = calculateHolderReward(holderBalance, totalSupply, rewardPool);
      expect(reward).toBe(100000000000000000n);
    });
  });

  describe('calculateEffectiveBalance (H-03 Flash Loan Protection)', () => {
    it('takes minimum of snapshot balance and live balance', () => {
      // Normal holding: snapshot 100, live 100 -> 100
      expect(calculateEffectiveBalance(100n, 100n)).toBe(100n);

      // Holder sold tokens: snapshot 100, live 0 -> 0 (cannot earn post-sale)
      expect(calculateEffectiveBalance(100n, 0n)).toBe(0n);

      // Flash loan attacker buys tokens: snapshot 0, live 1,000,000 -> 0 (cannot retroactively earn)
      expect(calculateEffectiveBalance(0n, 1000000n)).toBe(0n);
    });
  });
});
