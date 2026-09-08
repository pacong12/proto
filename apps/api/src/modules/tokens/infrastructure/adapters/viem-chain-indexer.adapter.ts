import { createPublicClient, http, PublicClient } from 'viem';
import {
  LaunchedTokenEntity,
  GraduationStatus,
  ROBINHOOD_CHAIN,
  launchpadFactoryAbi,
  launchpadTokenAbi,
  uniswapV3PoolAbi,
} from '@proto/shared-types';
import { ChainIndexerPort } from '../../domain/ports/chain.indexer.port';

export class ViemChainIndexerAdapter implements ChainIndexerPort {
  private client: PublicClient;

  constructor(rpcUrl = ROBINHOOD_CHAIN.rpcUrl) {
    this.client = createPublicClient({
      chain: {
        id: ROBINHOOD_CHAIN.chainId,
        name: ROBINHOOD_CHAIN.name,
        nativeCurrency: ROBINHOOD_CHAIN.nativeCurrency,
        rpcUrls: { default: { http: [rpcUrl] } },
      },
      transport: http(),
    });
  }

  async fetchLaunchedTokenFromChain(tokenAddress: `0x${string}`): Promise<LaunchedTokenEntity | null> {
    try {
      const [tokenLaunchedData, name, symbol, decimals, logo, description, poolAddress, socials] =
        await Promise.all([
          this.client.readContract({
            address: ROBINHOOD_CHAIN.contracts.factory,
            abi: launchpadFactoryAbi,
            functionName: 'getLaunchedToken',
            args: [tokenAddress],
          }),
          this.client.readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'name',
          }),
          this.client.readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'symbol',
          }),
          this.client.readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'decimals',
          }),
          this.client.readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'logo',
          }),
          this.client.readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'description',
          }),
          this.client.readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'liquidityPool',
          }),
          this.client.readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'socials',
          }),
        ]);

      if (!tokenLaunchedData || !tokenLaunchedData.exists) return null;

      const [twitter, telegram, discord, website, farcaster] = socials;

      return {
        address: tokenAddress,
        name,
        symbol,
        decimals,
        totalSupply: tokenLaunchedData.supply.toString(),
        logo,
        description,
        socials: { twitter, telegram, discord, website, farcaster },
        deployer: tokenLaunchedData.deployer,
        pairedToken: tokenLaunchedData.pairedToken,
        poolAddress,
        isToken0: tokenLaunchedData.isToken0,
        poolFee: tokenLaunchedData.poolFee,
        positionId: tokenLaunchedData.positionId,
        restrictionsEndBlock: tokenLaunchedData.restrictionsEndBlock,
        launchBlock: tokenLaunchedData.restrictionsEndBlock - 2n,
        createdAt: Date.now(),
        initialBuyAmount: tokenLaunchedData.initialBuyAmount.toString(),
      };
    } catch {
      return null;
    }
  }

  async fetchGraduationStatus(tokenAddress: `0x${string}`): Promise<GraduationStatus> {
    try {
      const [pairedPrincipal, threshold, graduated] = await this.client.readContract({
        address: ROBINHOOD_CHAIN.contracts.factory,
        abi: launchpadFactoryAbi,
        functionName: 'graduationStatus',
        args: [tokenAddress],
      });

      const progress = Number(threshold) > 0 ? Number(pairedPrincipal) / Number(threshold) : 0;
      return {
        pairedPrincipal,
        threshold,
        graduated,
        progress: Math.min(1.0, progress),
      };
    } catch {
      return {
        pairedPrincipal: 0n,
        threshold: ROBINHOOD_CHAIN.launchConfig.graduationThresholdWei,
        graduated: false,
        progress: 0,
      };
    }
  }

  async fetchPoolSlot0(poolAddress: `0x${string}`): Promise<{ sqrtPriceX96: bigint; tick: number }> {
    try {
      const [sqrtPriceX96, tick] = await this.client.readContract({
        address: poolAddress,
        abi: uniswapV3PoolAbi,
        functionName: 'slot0',
      });
      return { sqrtPriceX96, tick };
    } catch {
      return { sqrtPriceX96: 2505414483750479299401734n, tick: 0 };
    }
  }

  async fetchWethBalance(account: `0x${string}`): Promise<bigint> {
    try {
      return await this.client.getBalance({ address: account });
    } catch {
      return 0n;
    }
  }
}
