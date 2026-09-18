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
// Testnet: Robinhood Chain Testnet (Chain ID 46630)
//
// All addresses below must be independent testnet deployments.
// Contracts not yet deployed on testnet use the zero address as a sentinel
// so they are never accidentally treated as live contracts.
// Replace each zero address after completing the testnet deployment.
// ---------------------------------------------------------------------------

/** Sentinel value for contracts not yet deployed on testnet. */
const UNDEPLOYED = '0x0000000000000000000000000000000000000000' as const;

export const ROBINHOOD_TESTNET: NetworkConfig = {
  chainId: 46630,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrl: 'https://rpc.testnet.chain.robinhood.com',
  blockExplorer: 'https://testnet.robinhoodchain.blockscout.com',
  contracts: {
    // Factory V1 and V2 deployed together in run-1788953322631.
    factory: '0x3de11A992Ed6F9d6FA289f9A779a22eFFc1E27e8',
    factoryV2: '0x3de11A992Ed6F9d6FA289f9A779a22eFFc1E27e8',
    // TODO: deploy LiquidityLocker to testnet and replace this address.
    locker: UNDEPLOYED,
    // TODO: deploy or configure Uniswap V3 infrastructure on testnet.
    uniswapV3Factory: UNDEPLOYED,
    positionManager: UNDEPLOYED,
    swapRouter: UNDEPLOYED,
    quoterV2: UNDEPLOYED,
    // TODO: replace with the wrapped-ETH address on the testnet network.
    weth: UNDEPLOYED,
  },
  launchConfigV2: {
    supply: 1_000_000_000n * 10n ** 18n,
    curveTokenAllocation: 800_000_000n * 10n ** 18n,
    graduationTargetWei: 4_200_000_000_000_000_000n,
    platformFeeBps: 100,
    snipeTaxMaxBps: 9900,
  },
  launchConfig: {
    supply: 1_000_000_000n * 10n ** 18n,
    poolFee: 10000,
    launchFeeWei: 500_000_000_000_000n,
    graduationThresholdWei: 4_200_000_000_000_000_000n,
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
    decimals: 6,
  },
  rpcUrl: 'https://rpc.mainnet.arc.io',
  blockExplorer: 'https://explorer.arc.io',
  contracts: {
    // Arc Network currently operates purely on V2 bonding curve infrastructure.
    // factory and factoryV2 both point to the deployed LaunchpadV2Factory.
    factory: '0x48844223aBDceeb1Ce502F54d559681358E68200',
    factoryV2: '0x48844223aBDceeb1Ce502F54d559681358E68200',
    locker: '0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2',
    uniswapV3Factory: '0xf0db7b58379503491d857dB50AC9ece64c653918',
    positionManager: '0x39654A85A4C05127f5Fd6ED22CAeC077A0fB1377',
    swapRouter: '0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77',
    quoterV2: '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7',
    weth: '0x3600000000000000000000000000000000000000', // Native USDC on Arc
  },
  launchConfigV2: {
    supply: 1_000_000_000n * 10n ** 18n,
    curveTokenAllocation: 738_600_000n * 10n ** 18n, // 73.86% on curve, 26.14% for pool (Arc standard)
    graduationTargetWei: 69_000_000_000_000_000_000_000n, // 69,000 USDC graduation threshold
    platformFeeBps: 75, // 0.75% protocol fee
    snipeTaxMaxBps: 9900, // 99% decaying anti-snipe
  },
  launchConfig: {
    supply: 1_000_000_000n * 10n ** 18n,
    poolFee: 10000,
    // 1.00 USDC launch fee (18 decimals native msg.value on Arc Network per Circle Arc specs)
    launchFeeWei: 1_000_000_000_000_000_000n,
    graduationThresholdWei: 69_000_000_000_000_000_000_000n, // 69,000 USDC
    antiSnipeBlocks: 2,
    maxHoldPercent: 5.0,
    maxBuyPercent: 5.5,
    protocolFeeSharePercent: 75,
    creatorFeeSharePercent: 25,
  },
};

export const ARC_TESTNET: NetworkConfig = {
  chainId: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
  },
  rpcUrl: 'https://rpc.testnet.arc.io',
  blockExplorer: 'https://explorer.testnet.arc.io',
  contracts: {
    factory: '0x92cB206557907e4955faEeBd387D9602872d52cA',
    factoryV2: '0x9C7Ff544aAc9f4A4ECAE3ca8c110740888fF70E3',
    locker: '0x561723e55C27929f8C5317532c331c2a26060782',
    uniswapV3Factory: '0x867E249D61cb0951433FAfd72b15Acc63646D266',
    positionManager: '0x7bD82CA0E7fd5F4EfFFd69cb413CBf8E954c3660',
    swapRouter: '0x5b8953eFc63F70377fa8C23FBEE0EAD632B277Cd',
    quoterV2: '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7',
    weth: '0x3600000000000000000000000000000000000000', // Native USDC precompile
  },
  launchConfigV2: {
    supply: 1_000_000_000n * 10n ** 18n,
    curveTokenAllocation: 800_000_000n * 10n ** 18n,
    graduationTargetWei: 8_000_000_000_000_000_000_000n, // 8,000 USDC (18 decimals native msg.value)
    platformFeeBps: 100,
    snipeTaxMaxBps: 9900,
  },
  launchConfig: {
    supply: 1_000_000_000n * 10n ** 18n,
    poolFee: 10000,
    launchFeeWei: 1_000_000_000_000_000_000n, // 1 USDC (18 decimals native msg.value)
    graduationThresholdWei: 8_000_000_000_000_000_000_000n, // 8,000 USDC
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
  [ARC_TESTNET.chainId]: ARC_TESTNET,
  [ROBINHOOD_TESTNET.chainId]: ROBINHOOD_TESTNET,
};

export const DEFAULT_NETWORK: NetworkConfig = ROBINHOOD_CHAIN;

export function getNetworkConfig(chainId?: number): NetworkConfig {
  if (chainId && SUPPORTED_CHAINS[chainId]) {
    return SUPPORTED_CHAINS[chainId];
  }
  return DEFAULT_NETWORK;
}
