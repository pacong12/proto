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
  blockExplorer: 'https://robinhoodchain.blockout.com',
  contracts: {
    factory: '0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB',
    locker: '0x736D76699C26D0d966744cAe304C000d471f7F35',
    uniswapV3Factory: '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA',
    positionManager: '0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3',
    swapRouter: '0xCaf681a66D020601342297493863E78C959E5cb2',
    quoterV2: '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7',
    weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
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
