export interface NetworkConfig {
  chainId: number;
  name: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrl: string;
  blockExplorer: string;
  contracts: {
    factory: `0x${string}`;
    factoryV2?: `0x${string}`;
    locker: `0x${string}`;
    uniswapV3Factory: `0x${string}`;
    positionManager: `0x${string}`;
    swapRouter: `0x${string}`;
    quoterV2: `0x${string}`;
    weth: `0x${string}`;
  };
  launchConfig: {
    supply: bigint;
    poolFee: number;
    launchFeeWei: bigint;
    graduationThresholdWei: bigint;
    antiSnipeBlocks: number;
    maxHoldPercent: number;
    maxBuyPercent: number;
    protocolFeeSharePercent: number;
    creatorFeeSharePercent: number;
  };
  launchConfigV2?: {
    supply: bigint;
    curveTokenAllocation: bigint;
    graduationTargetWei: bigint;
    platformFeeBps: number;
    snipeTaxMaxBps: number;
  };
}

// ---------------------------------------------------------------------------
// Mainnet: Robinhood Chain (Chain ID 4663)
// ---------------------------------------------------------------------------

export const ROBINHOOD_CHAIN: NetworkConfig = {
  chainId: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrl: 'https://rpc.mainnet.chain.robinhood.com',
  blockExplorer: 'https://robinhoodchain.blockscout.com',
  contracts: {
    factory: '0x48844223aBDceeb1Ce502F54d559681358E68200',
    factoryV2: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e',
    locker: '0x070233B6F46ccD61CA2B7bc1E13520c3fE4614E4',
    uniswapV3Factory: '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA',
    positionManager: '0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3',
    swapRouter: '0xCaf681a66D020601342297493863E78C959E5cb2',
    quoterV2: '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7',
    weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
  },
  launchConfigV2: {
    supply: 1_000_000_000n * 10n ** 18n,
    curveTokenAllocation: 800_000_000n * 10n ** 18n, // 80% on curve, 20% reserved for graduation pool
    graduationTargetWei: 4_200_000_000_000_000_000n, // 4.2 ETH
    platformFeeBps: 100, // 1%
    snipeTaxMaxBps: 9900, // 99% decaying over 5 blocks
  },
  launchConfig: {
    supply: 1_000_000_000n * 10n ** 18n,
    poolFee: 10000, // 1%
    launchFeeWei: 500_000_000_000_000n, // 0.0005 ETH
    graduationThresholdWei: 4_200_000_000_000_000_000n, // 4.2 ETH
    antiSnipeBlocks: 2,
    maxHoldPercent: 5.0,
    maxBuyPercent: 5.5,
    protocolFeeSharePercent: 30,
    creatorFeeSharePercent: 70,
  },
};

// ---------------------------------------------------------------------------
// Mainnet: Arc Network (Chain ID 5042) - Circle Stablecoin L1
// Production Proto launchpad infrastructure on Arc Network
// ---------------------------------------------------------------------------

export const ARC_CHAIN: NetworkConfig = {
  chainId: 5042,
  name: 'Arc Network',
  nativeCurrency: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 18, // Arc EVM native USDC uses 18 decimals in msg.value (1 ether = 1.00 USDC)
  },
  rpcUrl: 'https://rpc.mainnet.arc.io',
  blockExplorer: 'https://explorer.arc.io',
  contracts: {
    // LaunchpadV2FactoryArc - correct Arc Standard constants (69K graduation, 4200 USDC virtual)
    // TODO: replace with new deployment address after re-deploy
    factory: '0x48844223aBDceeb1Ce502F54d559681358E68200',
    factoryV2: '0x48844223aBDceeb1Ce502F54d559681358E68200',
    // TODO: replace with LiquidityLocker deployment address after deploy
    locker: '0x0000000000000000000000000000000000000000',
    uniswapV3Factory: '0xf0db7b58379503491d857dB50AC9ece64c653918',
    positionManager: '0x39654A85A4C05127f5Fd6ED22CAeC077A0fB1377',
    swapRouter: '0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77',
    // TODO: verify correct QuoterV2 address on Arc Network
    quoterV2: '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7',
    weth: '0x3600000000000000000000000000000000000000', // Native USDC on Arc
  },
  launchConfigV2: {
    supply: 1_000_000_000n * 10n ** 18n,
    curveTokenAllocation: 738_600_000n * 10n ** 18n, // 73.86% on curve (Arc standard)
    graduationTargetWei: 69_000n * 10n ** 18n, // 69,000 USDC (18 decimals)
    platformFeeBps: 100, // 1% trading fee (Arc standard)
    snipeTaxMaxBps: 9900, // 99% decaying anti-snipe
  },
  launchConfig: {
    supply: 1_000_000_000n * 10n ** 18n,
    poolFee: 10000,
    launchFeeWei: 1n * 10n ** 18n, // 1.00 USDC (18 decimals native)
    graduationThresholdWei: 69_000n * 10n ** 18n, // 69,000 USDC
    antiSnipeBlocks: 2,
    maxHoldPercent: 5.0,
    maxBuyPercent: 5.5,
    protocolFeeSharePercent: 30,
    creatorFeeSharePercent: 70,
  },
};

export const SUPPORTED_CHAINS: Record<number, NetworkConfig> = {
  [ROBINHOOD_CHAIN.chainId]: ROBINHOOD_CHAIN,
  [ARC_CHAIN.chainId]: ARC_CHAIN,
};

export const DEFAULT_NETWORK: NetworkConfig = ROBINHOOD_CHAIN;

export function getNetworkConfig(chainId?: number): NetworkConfig {
  if (chainId && SUPPORTED_CHAINS[chainId]) {
    return SUPPORTED_CHAINS[chainId];
  }
  return DEFAULT_NETWORK;
}
