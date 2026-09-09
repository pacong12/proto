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
    snipeTaxMaxBps: 9900, // 99% decaying in 5s
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
    factory: '0x3de11A992Ed6F9d6FA289f9A779a22eFFc1E27e8',
    factoryV2: '0x3de11A992Ed6F9d6FA289f9A779a22eFFc1E27e8',
    locker: '0x070233B6F46ccD61CA2B7bc1E13520c3fE4614E4',
    uniswapV3Factory: '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA',
    positionManager: '0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3',
    swapRouter: '0xCaf681a66D020601342297493863E78C959E5cb2',
    quoterV2: '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7',
    weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
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

export const SUPPORTED_CHAINS: Record<number, NetworkConfig> = {
  [ROBINHOOD_CHAIN.chainId]: ROBINHOOD_CHAIN,
  [ROBINHOOD_TESTNET.chainId]: ROBINHOOD_TESTNET,
};
