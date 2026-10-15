export * from './v2/bonding-curve.abi';
export * from './v2/launchpad-token.abi';
export * from './v2/launchpad-v2-factory.abi';
export * from './v2/launchpad-v2-factory-arc.abi';
export * from './v2/holder-fee-distributor.abi';
export * from './v2/buyback-burner.abi';
export * from './v2/liquidity-locker.abi';
export * from './v2/vesting-vault.abi';
export * from './v2/proto-liquidity-locker-v4.abi';
export * from './v2/proto-meme-hook.abi';
export * from './external/dex.abi';
export * from './chains';

import { launchpadV2FactoryAbi } from './v2/launchpad-v2-factory.abi';
import { launchpadV2FactoryArcAbi } from './v2/launchpad-v2-factory-arc.abi';

/**
 * Returns the appropriate factory ABI based on chain ID.
 * Scalable: provides a centralized helper instead of forcing consumers to branch manually.
 */
export function getFactoryV2Abi(chainId?: number): typeof launchpadV2FactoryAbi {
  if (chainId === 5042) {
    return launchpadV2FactoryArcAbi as unknown as typeof launchpadV2FactoryAbi;
  }
  return launchpadV2FactoryAbi;
}
