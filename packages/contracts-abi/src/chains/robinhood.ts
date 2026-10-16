import type { ChainAbis } from './types';
import { launchpadV2FactoryAbi } from '../v2/launchpad-v2-factory.abi';
import { bondingCurveAbi } from '../v2/bonding-curve.abi';
import { launchpadTokenAbi } from '../v2/launchpad-token.abi';
import { buybackBurnerAbi } from '../v2/buyback-burner.abi';
import { vestingVaultAbi } from '../v2/vesting-vault.abi';
import { gotonV4HookAbi } from '../v2/goton-v4-hook.abi';
import { gotonFeeSplitterAbi } from '../v2/goton-fee-splitter.abi';
import { gotonV4GraduatorAbi } from '../v2/goton-v4-graduator.abi';
import { gotonV4RouterAbi } from '../v2/goton-v4-router.abi';
import { gotonV4BuybackAbi } from '../v2/goton-v4-buyback.abi';

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
  graduator: gotonV4GraduatorAbi,
  memeHook: gotonV4HookAbi,
  feeSplitter: gotonFeeSplitterAbi,
  router: gotonV4RouterAbi,
  buyback: gotonV4BuybackAbi,
  buybackBurner: buybackBurnerAbi,
  vestingVault: vestingVaultAbi,
} as const;
ROBINHOOD_ABIS satisfies ChainAbis;

export { launchpadV2FactoryAbi as robinhoodFactoryAbi };
