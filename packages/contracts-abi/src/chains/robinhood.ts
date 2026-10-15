import { launchpadV2FactoryAbi } from '../v2/launchpad-v2-factory.abi';
import { bondingCurveAbi } from '../v2/bonding-curve.abi';
import { launchpadTokenAbi } from '../v2/launchpad-token.abi';
import { liquidityLockerAbi } from '../v2/liquidity-locker.abi';
import { holderFeeDistributorAbi } from '../v2/holder-fee-distributor.abi';
import { buybackBurnerAbi } from '../v2/buyback-burner.abi';
import { vestingVaultAbi } from '../v2/vesting-vault.abi';
import { protoLiquidityLockerV4Abi } from '../v2/proto-liquidity-locker-v4.abi';
import { protoMemeHookAbi } from '../v2/proto-meme-hook.abi';

/**
 * Robinhood Chain (Chain ID: 4663) Sovereign Smart Contract ABIs
 */
export const ROBINHOOD_ABIS = {
  factoryV2: launchpadV2FactoryAbi,
  bondingCurve: bondingCurveAbi,
  token: launchpadTokenAbi,
  locker: liquidityLockerAbi,
  lockerV4: protoLiquidityLockerV4Abi,
  memeHookV4: protoMemeHookAbi,
  holderFeeDistributor: holderFeeDistributorAbi,
  buybackBurner: buybackBurnerAbi,
  vestingVault: vestingVaultAbi,
} as const;

export {
  launchpadV2FactoryAbi as robinhoodFactoryAbi,
  protoLiquidityLockerV4Abi,
  protoMemeHookAbi,
};
