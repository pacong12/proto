import type { ChainAbis } from './types';
import { launchpadV2FactoryArcAbi } from '../v2/launchpad-v2-factory-arc.abi';
import { launchpadTokenAbi } from '../v2/launchpad-token.abi';
import { vestingVaultAbi } from '../v2/vesting-vault.abi';
import { protoV4HookAbi } from '../v2/proto-v4-hook.abi';
import { protoFeeSplitterAbi } from '../v2/proto-fee-splitter.abi';
import { protoV4RouterAbi } from '../v2/proto-v4-router.abi';
import { protoV4BuybackAbi } from '../v2/proto-v4-buyback.abi';

/**
 * Arc Network (Chain ID: 5042) Smart Contract ABIs.
 * In-pool Uniswap v4 launch model: no bonding curve, no V3 locker.
 */
export const ARC_ABIS = {
  chainId: 5042,
  slug: 'arc',
  factoryV2: launchpadV2FactoryArcAbi,
  token: launchpadTokenAbi,
  memeHook: protoV4HookAbi,
  feeSplitter: protoFeeSplitterAbi,
  router: protoV4RouterAbi,
  buyback: protoV4BuybackAbi,
  vestingVault: vestingVaultAbi,
} as const;
ARC_ABIS satisfies ChainAbis;

export { launchpadV2FactoryArcAbi as arcFactoryAbi };
