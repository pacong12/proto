import type { NetworkConfig } from '../constants/network';
import { getEnv, getEnvBigInt } from './env';

/**
 * Robinhood Chain (Chain ID: 4663)
 * EVM Layer 2 powered by Arbitrum Nitro stack.
 * Native gas asset: ETH (18 decimals).
 * All addresses and parameters are read dynamically from environment variables (.env).
 */
export const ROBINHOOD_NETWORK: NetworkConfig = {
  chainId: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrl: getEnv('ROBINHOOD_RPC_URL', 'https://rpc.mainnet.chain.robinhood.com'),
  rpcUrls: [getEnv('ROBINHOOD_RPC_URL', 'https://rpc.mainnet.chain.robinhood.com')],
  blockExplorer: getEnv(
    'ROBINHOOD_BLOCK_EXPLORER_URL',
    getEnv('BLOCK_EXPLORER_URL', 'https://robinhoodchain.blockscout.com'),
  ),
  contracts: {
    factory: getEnv(
      'ROBINHOOD_FACTORY_ADDRESS',
      getEnv('LAUNCHPAD_FACTORY_ADDRESS', '0xcC547D4EC0eF85FE506D2b2EEe02Be3620178B16'),
    ) as `0x${string}`,
    factoryV2: getEnv(
      'ROBINHOOD_FACTORY_V2_ADDRESS',
      getEnv('LAUNCHPAD_V2_FACTORY_ADDRESS', '0x094858C1C9721506D3384eC8f6a97b61A34a5896'),
    ) as `0x${string}`,
    locker: getEnv(
      'ROBINHOOD_LOCKER_ADDRESS',
      getEnv('LIQUIDITY_LOCKER_ADDRESS', '0xf60664BEadbcBe25aFFdae0e7E2a41a819c81FCe'),
    ) as `0x${string}`,
    uniswapV3Factory: getEnv(
      'ROBINHOOD_V3_FACTORY',
      getEnv('V3_FACTORY', '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA'),
    ) as `0x${string}`,
    positionManager: getEnv(
      'ROBINHOOD_POSITION_MANAGER',
      getEnv('POSITION_MANAGER', '0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3'),
    ) as `0x${string}`,
    swapRouter: getEnv(
      'ROBINHOOD_SWAP_ROUTER',
      getEnv('SWAP_ROUTER', '0xCaf681a66D020601342297493863E78C959E5cb2'),
    ) as `0x${string}`,
    quoterV2: getEnv(
      'ROBINHOOD_QUOTER_V2',
      getEnv('QUOTER_V2', '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7'),
    ) as `0x${string}`,
    weth: getEnv(
      'ROBINHOOD_WETH_ADDRESS',
      getEnv('WETH_ADDRESS', '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73'),
    ) as `0x${string}`,
  },
  launchConfigV2: {
    supply: 1_000_000_000n * 10n ** 18n,
    curveTokenAllocation: 800_000_000n * 10n ** 18n, // 80% on curve, 20% reserved for graduation pool
    graduationTargetWei: getEnvBigInt(
      'ROBINHOOD_GRADUATION_TARGET_WEI',
      getEnvBigInt('GRADUATION_TARGET_WEI', 4_200_000_000_000_000_000n),
    ), // 4.2 ETH
    platformFeeBps: 100, // 1%
    snipeTaxMaxBps: 9900, // 99% decaying over 5 blocks
  },
  launchConfig: {
    supply: 1_000_000_000n * 10n ** 18n,
    poolFee: 10000, // 1%
    launchFeeWei: getEnvBigInt(
      'ROBINHOOD_LAUNCH_FEE_WEI',
      getEnvBigInt('LAUNCH_FEE_WEI', 500_000_000_000_000n),
    ), // 0.0005 ETH
    graduationThresholdWei: getEnvBigInt(
      'ROBINHOOD_GRADUATION_THRESHOLD_WEI',
      getEnvBigInt('GRADUATION_THRESHOLD_WEI', 4_200_000_000_000_000_000n),
    ), // 4.2 ETH
    antiSnipeBlocks: 2,
    maxHoldPercent: 5.0,
    maxBuyPercent: 5.5,
    protocolFeeSharePercent: 30,
    creatorFeeSharePercent: 70,
  },
};
