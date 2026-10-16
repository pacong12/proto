import type { ChainAbis } from './types';
import { launchpadV2FactoryArcAbi } from '../v2/launchpad-v2-factory-arc.abi';
import { launchpadTokenAbi } from '../v2/launchpad-token.abi';
import { vestingVaultAbi } from '../v2/vesting-vault.abi';
import { gotonV4HookAbi } from '../v2/goton-v4-hook.abi';
import { gotonFeeSplitterAbi } from '../v2/goton-fee-splitter.abi';
import { gotonV4RouterAbi } from '../v2/goton-v4-router.abi';
import { gotonV4BuybackAbi } from '../v2/goton-v4-buyback.abi';

/**
 * Arc Network (Chain ID: 5042) Smart Contract ABIs.
 * In-pool Uniswap v4 launch model: no bonding curve, no V3 locker.
 */
export const ARC_ABIS = {
  chainId: 5042,
  slug: 'arc',
  factoryV2: launchpadV2FactoryArcAbi,
  token: launchpadTokenAbi,
  memeHook: gotonV4HookAbi,
  feeSplitter: gotonFeeSplitterAbi,
  router: gotonV4RouterAbi,
  buyback: gotonV4BuybackAbi,
  vestingVault: vestingVaultAbi,
} as const;
ARC_ABIS satisfies ChainAbis;

export { launchpadV2FactoryArcAbi as arcFactoryAbi };
