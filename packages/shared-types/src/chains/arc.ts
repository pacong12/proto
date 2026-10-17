import { UNDEPLOYED, type NetworkConfig } from './types';
import { getEnv } from './env';

/** Canonical Goton curve address for Arc Network (legacy bonding-curve launches). */
export const ARC_PROTO_CURVE_ADDRESS = getEnv(
  'ARC_PROTO_CURVE_ADDRESS',
  '0x6c1c1a77771bf8961e27ea5b21f575eb17a7626e',
) as `0x${string}`;

export const ARC_CHAIN_ID = 5042 as const;

/** Native USDC precompile-backed ERC-20 (6 decimals); also the quote currency of every pool. */
const ARC_USDC = '0x3600000000000000000000000000000000000000' as `0x${string}`;

/** Pre-v4 deployments kept so their tokens still resolve to Arc. */
const ARC_LEGACY_POOL_ADDRESS = '0x00689b589add3ee1995e26e7f4e5cbf262486eb4' as `0x${string}`;
const ARC_LEGACY_CURVE_FACTORY = '0xf94d16c9E90fCd55b75D318d0104269146612abF' as `0x${string}`;

/** Launch position parameters (same values as ARC_MATH_CONFIG in @goton/math-sdk). */
const ARC_LAUNCH_LIQUIDITY = 1575037795897358225n;
const ARC_INITIAL_SQRT_PRICE_X96 = 50302388120867331857465247907496697271n;
const ARC_BOND_SQRT_PRICE_X96 = 11800301107109846379556182205197121619n;

/**
 * Arc Network (Chain ID: 5042)
 * Circle Stablecoin L1. Native gas asset is USDC with 18 decimals in msg.value (1 ether = 1.00 USDC).
 *
 * Launch model: in-pool Uniswap v4 (Argus portal parameters). Tokens trade in their v4 pool from
 * the first block; there is no bonding-curve contract and no Uniswap V3 dependency. Values below
 * mirror `ARC_MATH_CONFIG` in @goton/math-sdk (kept in sync by chain-registry.spec.ts).
 *
 * Set ARC_V4_FACTORY_ADDRESS / ARC_MEME_HOOK / ARC_V4_ROUTER after running contracts/script/arc/DeployArc.s.sol.
 */
export const ARC_NETWORK: NetworkConfig = {
  chainId: ARC_CHAIN_ID,
  slug: 'arc',
  knownAddresses: [ARC_PROTO_CURVE_ADDRESS, ARC_LEGACY_POOL_ADDRESS, ARC_LEGACY_CURVE_FACTORY],
  name: 'Arc Network',
  icon: '/chains/arc.svg',
  nativeCurrency: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 18, // Arc EVM native USDC uses 18 decimals in msg.value (1 ether = 1.00 USDC)
  },
  rpcUrl: getEnv('ARC_RPC_URL', 'https://rpc.mainnet.arc.io'),
  rpcUrls: [
    getEnv('ARC_RPC_URL', 'https://rpc.mainnet.arc.io'),
    'https://rpc.blockdaemon.mainnet.arc.io',
    'https://rpc.drpc.mainnet.arc.io',
    'https://arc.drpc.org',
  ],
  blockExplorer: getEnv('ARC_BLOCK_EXPLORER_URL', 'https://explorer.arc.io'),
  contracts: {
    factory: getEnv('ARC_V4_FACTORY_ADDRESS', UNDEPLOYED) as `0x${string}`,
    factoryV2: getEnv('ARC_V4_FACTORY_ADDRESS', UNDEPLOYED) as `0x${string}`,
    // LP is locked as a factory-owned v4 position; there is no separate locker.
    locker: UNDEPLOYED,
    // Holder dividends are paid by a per-token GotonFeeSplitter.
    holderFeeDistributor: UNDEPLOYED,
    weth: ARC_USDC,
    memeHook: getEnv('ARC_MEME_HOOK', UNDEPLOYED) as `0x${string}`,
    router: getEnv('ARC_V4_ROUTER', UNDEPLOYED) as `0x${string}`,
    buyback: getEnv('ARC_V4_BUYBACK', UNDEPLOYED) as `0x${string}`,
    limitOrders: getEnv('ARC_LIMIT_ORDERS', UNDEPLOYED) as `0x${string}`,
    poolManagerV4: getEnv(
      'ARC_POOL_MANAGER_V4',
      '0x8366a39CC670B4001A1121B8F6A443A643e40951',
    ) as `0x${string}`,
    positionManagerV4: getEnv(
      'ARC_POSITION_MANAGER_V4',
      '0x6049c9a0e26405C0985f9E3685C87d0aE917f82B',
    ) as `0x${string}`,
    universalRouter: getEnv(
      'ARC_UNIVERSAL_ROUTER',
      '0x4fcA4a51Ab4F23A7447b3284fBd7D73289A89Fb1',
    ) as `0x${string}`,
    permit2: getEnv('ARC_PERMIT2', '0x000000000022D473030F116dDEE9F6B43aC78BA3') as `0x${string}`,
    canonicalUsdc: ARC_USDC,
  },
  launchConfigV2: {
    supply: 1_000_000_000n * 10n ** 18n,
    // Tokens bought by graduation: L * (sqrtP_open - sqrtP_bond) / 2^96
    curveTokenAllocation:
      (ARC_LAUNCH_LIQUIDITY * (ARC_INITIAL_SQRT_PRICE_X96 - ARC_BOND_SQRT_PRICE_X96)) / 2n ** 96n,
    virtualReserveWei: 2_480_744_058n * 10n ** 12n, // opening market cap ≈ $2,480.74 (tick 405400)
    graduationTargetWei: 8_094_185_287n * 10n ** 12n, // USDC to reach bond tick 376400 (≈ $45,079 FDV)
    platformFeeBps: 100, // 1% v4 pool fee
    snipeTaxMaxBps: 9900, // 99% decaying anti-snipe (hook, first 3 seconds)
    minPrebuyWei: 4_500_000_000_000_000_000n, // 4.50 USDC mandatory creator prebuy
  },
  launchConfig: {
    supply: 1_000_000_000n * 10n ** 18n,
    poolFee: 10000,
    launchFeeWei: 0n,
    graduationThresholdWei: 8_094_185_287n * 10n ** 12n,
    antiSnipeBlocks: 0, // anti-snipe is time-based in the hook
    maxHoldPercent: 100, // no wallet cap; creator prebuy is capped at 5% of supply
    maxBuyPercent: 5,
    protocolFeeSharePercent: 30, // protocol cut of every tax payment
    creatorFeeSharePercent: 70,
  },
};
