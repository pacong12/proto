import { BPS, CREATOR_FEE_BPS, HOLDER_FEE_BPS } from './constants';

export interface FeeSplitResult {
  creatorFeeWei: bigint;
  holderFeeWei: bigint;
  buybackFeeWei: bigint;
}

export interface LockerFeeSplitResult {
  creatorFeeWei: bigint;
  protocolFeeWei: bigint;
}

/**
 * Splits accrued trading fees in LiquidityLocker.sol:
 * - 70% to token creator (or fee redirect address)
 * - 30% to protocol recipient
 */
export function calculateLockerFeeSplit(
  totalFeeWei: bigint,
  protocolPercent = 30n,
): LockerFeeSplitResult {
  if (totalFeeWei <= 0n) {
    return { creatorFeeWei: 0n, protocolFeeWei: 0n };
  }
  const protocolFeeWei = (totalFeeWei * protocolPercent) / 100n;
  const creatorFeeWei = totalFeeWei - protocolFeeWei;
  return { creatorFeeWei, protocolFeeWei };
}

/**
 * Splits accrued protocol trading fees according to the canonical 70/20/10 model:
 * - 70% to token creator (LiquidityLocker)
 * - 20% to token holders pro-rata (HolderFeeDistributor)
 * - 10% to automated buyback & burner (BuybackBurner)
 */
export function calculateFeeSplit(totalFeeWei: bigint): FeeSplitResult {
  if (totalFeeWei <= 0n) {
    return {
      creatorFeeWei: 0n,
      holderFeeWei: 0n,
      buybackFeeWei: 0n,
    };
  }

  const creatorFeeWei = (totalFeeWei * CREATOR_FEE_BPS) / BPS;
  const holderFeeWei = (totalFeeWei * HOLDER_FEE_BPS) / BPS;
  // Residue assigned to buyback to guarantee zero wei leakage from integer division
  const buybackFeeWei = totalFeeWei - creatorFeeWei - holderFeeWei;

  return {
    creatorFeeWei,
    holderFeeWei,
    buybackFeeWei,
  };
}

/**
 * Calculates pro-rata dividend distribution for a holder.
 * formula: (holderBalance * totalDistributedReward) / totalSupply
 */
export function calculateHolderReward(
  holderBalanceWei: bigint,
  totalSupplyWei: bigint,
  rewardPoolWei: bigint,
): bigint {
  if (holderBalanceWei <= 0n || totalSupplyWei <= 0n || rewardPoolWei <= 0n) {
    return 0n;
  }
  return (holderBalanceWei * rewardPoolWei) / totalSupplyWei;
}

/**
 * Enforces HolderFeeDistributor.sol H-03 security rule:
 * effectiveBalance = min(snapshotBalance, liveBalance).
 * Protects against flash-loan dividend theft.
 */
export function calculateEffectiveBalance(
  snapshotBalanceWei: bigint,
  liveBalanceWei: bigint,
): bigint {
  return snapshotBalanceWei < liveBalanceWei ? snapshotBalanceWei : liveBalanceWei;
}
