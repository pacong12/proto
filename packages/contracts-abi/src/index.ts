export * from './v2/launchpad-factory-v1.abi';
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
export * from './v2/goton-v4-hook.abi';
export * from './v2/goton-fee-splitter.abi';
export * from './v2/goton-v4-graduator.abi';
export * from './v2/goton-v4-router.abi';
export * from './v2/goton-limit-orders.abi';
export * from './v2/goton-team-splitter.abi';
export * from './v2/goton-team-splitter-factory.abi';
export * from './v2/goton-v4-buyback.abi';
export * from './external/dex.abi';
export * from './chains';

import { launchpadV2FactoryAbi } from './v2/launchpad-v2-factory.abi';
import { getChainAbis } from './chains/registry';

/**
 * Returns the factory ABI registered for the given chain ID.
 * Typed as the Robinhood factory ABI for backward compatibility with existing call sites;
 * the Arc factory exposes a different (in-pool v4) interface — use `ARC_ABIS.factoryV2` there.
 */
export function getFactoryV2Abi(chainId?: number): typeof launchpadV2FactoryAbi {
  return getChainAbis(chainId).factoryV2 as unknown as typeof launchpadV2FactoryAbi;
}
