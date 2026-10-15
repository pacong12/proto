import { launchpadV2FactoryArcAbi } from '../v2/launchpad-v2-factory-arc.abi';
import { bondingCurveAbi } from '../v2/bonding-curve.abi';
import { launchpadTokenAbi } from '../v2/launchpad-token.abi';
import { liquidityLockerAbi } from '../v2/liquidity-locker.abi';
import { holderFeeDistributorAbi } from '../v2/holder-fee-distributor.abi';
import { vestingVaultAbi } from '../v2/vesting-vault.abi';

/**
 * Arc Network (Chain ID: 5042) Smart Contract ABIs
 */
export const ARC_ABIS = {
  factoryV2: launchpadV2FactoryArcAbi,
  bondingCurve: bondingCurveAbi,
  token: launchpadTokenAbi,
  locker: liquidityLockerAbi,
  holderFeeDistributor: holderFeeDistributorAbi,
  vestingVault: vestingVaultAbi,
} as const;

export { launchpadV2FactoryArcAbi as arcFactoryAbi };
