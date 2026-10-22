import { UNDEPLOYED, type NetworkConfig } from './types';
import { getEnv, getEnvBigInt } from './env';

/**
 * Robinhood Chain (Chain ID: 4663)
 * EVM Layer 2 powered by Arbitrum Nitro stack.
 * Native gas asset: ETH (18 decimals).
 * Launch model: bonding curve, then permissionless graduation into a locked native-ETH Uniswap v4
 * pool via GotonV4Graduator. Set ROBINHOOD_FACTORY_V2_ADDRESS / ROBINHOOD_GRADUATOR /
 * ROBINHOOD_V4_HOOK / ROBINHOOD_V4_ROUTER after running contracts/script/robinhood/DeployRobinhoodV2.s.sol.
 * All addresses and parameters are read dynamically from environment variables (.env).
 */
export const ROBINHOOD_CHAIN_ID = 4663 as const;

export const ROBINHOOD_NETWORK: NetworkConfig = {
  chainId: ROBINHOOD_CHAIN_ID,
  slug: 'robinhood',
  name: 'Robinhood Chain',
  icon: '/chains/robinhood.svg',
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
      'ROBINHOOD_FACTORY_V2_ADDRESS',
      getEnv('ROBINHOOD_FACTORY_ADDRESS', '0x0b85876120e797Ca19655C0B81a0C25573f3Fc18'),
    ) as `0x${string}`,
    factoryV2: getEnv(
      'ROBINHOOD_FACTORY_V2_ADDRESS',
      getEnv('ROBINHOOD_FACTORY_ADDRESS', '0x0b85876120e797Ca19655C0B81a0C25573f3Fc18'),
    ) as `0x${string}`,
    locker: getEnv(
      'ROBINHOOD_LOCKER_ADDRESS',
      getEnv('LIQUIDITY_LOCKER_ADDRESS', '0x7A1AD6AD30B1c9e276eD80a853E8dA897fE5D63E'),
    ) as `0x${string}`,
    // Not yet deployed to Robinhood mainnet. Fill in the address once deployed.
    holderFeeDistributor: '0x0000000000000000000000000000000000000000' as `0x${string}`,
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
    // v4 graduation stack (DeployRobinhoodV2, 2026-10-18). Tokens from the pre-v4 factory
    // 0x9f1f…0748 stay indexed from the database but cannot graduate through it.
    memeHook: getEnv(
      'ROBINHOOD_V4_HOOK',
      '0xb5C88A6101e6b979Ad63Bf5e6302dF8F031360Cc',
    ) as `0x${string}`,
    graduator: getEnv(
      'ROBINHOOD_GRADUATOR',
      '0xaEF6Fff944007b94a51F37e82cf5235fDBF9b771',
    ) as `0x${string}`,
    router: getEnv(
      'ROBINHOOD_V4_ROUTER',
      '0x5F88CE2BeD0f2639133b5EeB8b8fFE1fD50BA2dc',
    ) as `0x${string}`,
    buyback: getEnv(
      'ROBINHOOD_V4_BUYBACK',
      '0x240547f435Fe98B8B3F14036936D3a3e0EE87213',
    ) as `0x${string}`,
    limitOrders: getEnv(
      'ROBINHOOD_LIMIT_ORDERS',
      '0x2f3212D06104eEbb5bA4FA934B9B55b906dC3F61',
    ) as `0x${string}`,
    teamSplitterFactory: getEnv('ROBINHOOD_TEAM_SPLITTER_FACTORY', UNDEPLOYED) as `0x${string}`,
    poolManagerV4: getEnv(
      'ROBINHOOD_POOL_MANAGER_V4',
      '0x8366a39CC670B4001A1121B8F6A443A643e40951',
    ) as `0x${string}`,
    positionManagerV4: '0x58daec3116aae6D93017bAAea7749052E8a04fA7' as `0x${string}`,
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as `0x${string}`,
  },
  launchConfigV2: {
    supply: 1_000_000_000n * 10n ** 18n,
    curveTokenAllocation: 714_285_714n * 10n ** 18n, // 71.43% on curve (Pons 5/7 model), 28.57% (2/7) reserved for graduation pool
    virtualReserveWei: 1_680_000_000_000_000_000n, // 1.68 ETH (Pons standard)
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
