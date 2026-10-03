import type { NetworkConfig } from '../constants/network';
import { getEnv, getEnvBigInt } from './env';

/** Canonical Proto curve address for Arc Network */
export const ARC_PROTO_CURVE_ADDRESS = getEnv(
  'ARC_PROTO_CURVE_ADDRESS',
  '0x6c1c1a77771bf8961e27ea5b21f575eb17a7626e',
) as `0x${string}`;

/**
 * Arc Network (Chain ID: 5042)
 * Circle Stablecoin L1. Native gas asset is USDC with 18 decimals in msg.value (1 ether = 1.00 USDC).
 * All addresses and parameters are read dynamically from environment variables (.env).
 */
export const ARC_NETWORK: NetworkConfig = {
  chainId: 5042,
  name: 'Arc Network',
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
    factory: getEnv(
      'ARC_FACTORY_ADDRESS',
      '0xf94d16c9E90fCd55b75D318d0104269146612abF',
    ) as `0x${string}`,
    factoryV2: getEnv(
      'ARC_FACTORY_V2_ADDRESS',
      getEnv('ARC_FACTORY_ADDRESS', '0xf94d16c9E90fCd55b75D318d0104269146612abF'),
    ) as `0x${string}`,
    locker: getEnv(
      'ARC_LOCKER_ADDRESS',
      '0x173FF5D4eF626869a5a35FF0EA0c56c0A7e4Cd8b',
    ) as `0x${string}`,
    // Not yet deployed to Arc mainnet. Fill in the address once deployed.
    holderFeeDistributor: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    uniswapV3Factory: getEnv(
      'ARC_V3_FACTORY',
      '0xf0db7b58379503491d857dB50AC9ece64c653918',
    ) as `0x${string}`,
    positionManager: getEnv(
      'ARC_POSITION_MANAGER',
      '0x39654A85A4C05127f5Fd6ED22CAeC077A0fB1377',
    ) as `0x${string}`,
    swapRouter: getEnv(
      'ARC_SWAP_ROUTER',
      '0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77',
    ) as `0x${string}`,
    quoterV2: getEnv(
      'ARC_QUOTER_V2',
      '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7',
    ) as `0x${string}`,
    weth: getEnv('ARC_WETH_ADDRESS', '0x3600000000000000000000000000000000000000') as `0x${string}`, // Native USDC standard on Arc
  },
  launchConfigV2: {
    supply: 1_000_000_000n * 10n ** 18n,
    curveTokenAllocation: 738_600_000n * 10n ** 18n, // 73.86% on curve (Arc standard)
    graduationTargetWei: getEnvBigInt('ARC_GRADUATION_TARGET_WEI', 69_000n * 10n ** 18n),
    platformFeeBps: 100, // 1% trading fee (Arc standard)
    snipeTaxMaxBps: 9900, // 99% decaying anti-snipe
  },
  launchConfig: {
    supply: 1_000_000_000n * 10n ** 18n,
    poolFee: 10000,
    launchFeeWei: getEnvBigInt('ARC_LAUNCH_FEE_WEI', 1_000_000_000_000_000_000n), // 1.00 USDC
    graduationThresholdWei: getEnvBigInt('ARC_GRADUATION_THRESHOLD_WEI', 69_000n * 10n ** 18n),
    antiSnipeBlocks: 2,
    maxHoldPercent: 5.0,
    maxBuyPercent: 5.5,
    protocolFeeSharePercent: 30,
    creatorFeeSharePercent: 70,
  },
};
