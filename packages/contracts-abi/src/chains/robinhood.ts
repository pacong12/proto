import type { ChainAbis } from './types';
import { launchpadV2FactoryAbi } from '../v2/launchpad-v2-factory.abi';
import { bondingCurveAbi } from '../v2/bonding-curve.abi';
import { launchpadTokenAbi } from '../v2/launchpad-token.abi';
import { buybackBurnerAbi } from '../v2/buyback-burner.abi';
import { vestingVaultAbi } from '../v2/vesting-vault.abi';
import { protoV4HookAbi } from '../v2/proto-v4-hook.abi';
import { protoFeeSplitterAbi } from '../v2/proto-fee-splitter.abi';
import { protoV4GraduatorAbi } from '../v2/proto-v4-graduator.abi';
import { protoV4RouterAbi } from '../v2/proto-v4-router.abi';
import { protoV4BuybackAbi } from '../v2/proto-v4-buyback.abi';

/**
 * Robinhood Chain (Chain ID: 4663) Smart Contract ABIs.
 * Bonding curve → permissionless graduation into a locked native-ETH Uniswap v4 pool.
 * (Legacy lockers / ProtoMemeHook remain exported from the package root.)
 */
export const ROBINHOOD_ABIS = {
  chainId: 4663,
  slug: 'robinhood',
  factoryV2: launchpadV2FactoryAbi,
  bondingCurve: bondingCurveAbi,
  token: launchpadTokenAbi,
  graduator: protoV4GraduatorAbi,
  memeHook: protoV4HookAbi,
  feeSplitter: protoFeeSplitterAbi,
  router: protoV4RouterAbi,
  buyback: protoV4BuybackAbi,
  buybackBurner: buybackBurnerAbi,
  vestingVault: vestingVaultAbi,
} as const;
ROBINHOOD_ABIS satisfies ChainAbis;

export { launchpadV2FactoryAbi as robinhoodFactoryAbi };
