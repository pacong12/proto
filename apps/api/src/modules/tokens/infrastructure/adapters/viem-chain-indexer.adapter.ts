import { createPublicClient, http, PublicClient, type Address } from 'viem';
import {
  LaunchedTokenEntity,
  GraduationStatus,
  CHAINS,
  DEFAULT_NETWORK,
  launchpadFactoryAbi,
  launchpadTokenAbi,
  uniswapV3PoolAbi,
  toViemChain,
  findFactoryLaunch,
  readCurveState,
  readTokenMetadata,
  readV2LaunchedToken,
  type CurveState,
  type NetworkConfig,
} from '@goton/shared-types';
import { ChainIndexerPort } from '../../domain/ports/chain.indexer.port';

export class ViemChainIndexerAdapter implements ChainIndexerPort {
  private readonly clients = new Map<number, PublicClient>();

  getClient(cfg: NetworkConfig): PublicClient {
    let client = this.clients.get(cfg.chainId);
    if (!client) {
      client = createPublicClient({
        chain: toViemChain(cfg),
        transport: http(cfg.rpcUrl, { retryCount: 0, timeout: 10_000 }),
      });
      this.clients.set(cfg.chainId, client);
    }
    return client;
  }

  // -------------------------------------------------------------------------
  // V2 bonding-curve token indexer
  // Called when EventPoller receives a TokenLaunchedV2 event.
  // -------------------------------------------------------------------------
  async fetchV2LaunchedToken(
    tokenAddress: Address,
    curveAddress: Address,
    networkConfig: NetworkConfig,
  ): Promise<LaunchedTokenEntity | null> {
    try {
      return await readV2LaunchedToken(
        this.getClient(networkConfig),
        networkConfig,
        tokenAddress,
        curveAddress,
      );
    } catch {
      return null;
    }
  }

  /**
   * Builds the entity for a token launched straight into a Uniswap v4 pool (TokenLaunchedV4).
   * `poolAddress` stores the v4 pool id so swaps can be matched to the token.
   */
  async fetchV4LaunchedToken(
    tokenAddress: Address,
    poolId: `0x${string}`,
    creator: Address,
    prebuyQuote: bigint,
    networkConfig: NetworkConfig,
  ): Promise<LaunchedTokenEntity | null> {
    try {
      const metadata = await readTokenMetadata(this.getClient(networkConfig), tokenAddress);
      const quote = networkConfig.contracts.weth;

      return {
        address: tokenAddress,
        ...metadata,
        totalSupply: metadata.totalSupply.toString(),
        deployer: creator,
        pairedToken: quote,
        poolAddress: poolId,
        isToken0: BigInt(tokenAddress) < BigInt(quote),
        poolFee: networkConfig.launchConfig.poolFee,
        positionId: 0n,
        restrictionsEndBlock: 0n,
        launchBlock: 0n,
        createdAt: Date.now(),
        initialBuyAmount: prebuyQuote.toString(),
        version: 'v4',
        isGraduated: false,
        chainId: networkConfig.chainId,
      };
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // V2 on-demand factory resolver (hydrates newly created tokens even before event indexing)
  // -------------------------------------------------------------------------
  async fetchV2LaunchedTokenFromFactory(
    tokenAddress: Address,
    networkConfig?: NetworkConfig,
  ): Promise<LaunchedTokenEntity | null> {
    const cfg = networkConfig ?? DEFAULT_NETWORK;
    const launch = await findFactoryLaunch(this.getClient(cfg), cfg, tokenAddress);
    return launch ? this.fetchV2LaunchedToken(tokenAddress, launch.curve, cfg) : null;
  }

  // -------------------------------------------------------------------------
  // V1 pool token indexer (Uniswap V3 pool-based launches)
  // -------------------------------------------------------------------------
  async fetchLaunchedTokenFromChain(
    tokenAddress: Address,
    networkConfig?: NetworkConfig,
  ): Promise<LaunchedTokenEntity | null> {
    const cfg = networkConfig ?? DEFAULT_NETWORK;
    const client = this.getClient(cfg);

    try {
      const [tokenLaunchedData, metadata, poolAddress] = await Promise.all([
        client.readContract({
          address: cfg.contracts.factory as Address,
          abi: launchpadFactoryAbi,
          functionName: 'getLaunchedToken',
          args: [tokenAddress],
        }),
        readTokenMetadata(client, tokenAddress),
        client
          .readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'liquidityPool',
          })
          .catch(() => '0x0000000000000000000000000000000000000000'),
      ]);

      if (!tokenLaunchedData || !(tokenLaunchedData as { exists?: boolean }).exists) return null;

      const td = tokenLaunchedData as {
        deployer: Address;
        pairedToken: Address;
        isToken0: boolean;
        poolFee: number;
        positionId: bigint;
        restrictionsEndBlock: bigint;
        supply: bigint;
        initialBuyAmount: bigint;
        exists: boolean;
      };

      return {
        address: tokenAddress,
        ...metadata,
        totalSupply: td.supply.toString(),
        deployer: td.deployer,
        pairedToken: td.pairedToken,
        poolAddress: poolAddress as `0x${string}`,
        isToken0: td.isToken0,
        poolFee: td.poolFee,
        positionId: td.positionId,
        restrictionsEndBlock: td.restrictionsEndBlock,
        launchBlock: td.restrictionsEndBlock - 2n,
        createdAt: Date.now(),
        initialBuyAmount: td.initialBuyAmount.toString(),
        version: 'v1',
      };
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Fetch live on-chain graduation status for a V2 curve token
  // -------------------------------------------------------------------------
  async fetchV2CurveState(
    curveAddress: Address,
    networkConfig: NetworkConfig,
  ): Promise<CurveState> {
    try {
      return await readCurveState(this.getClient(networkConfig), curveAddress);
    } catch {
      // RPC unavailable: return safe defaults matching network launchConfigV2 parameters.
      return {
        totalEthRaised: 0n,
        virtualEthReserve: networkConfig.launchConfigV2?.virtualReserveWei ?? 0n,
        virtualTokenReserve: 1_000_000_000n * 10n ** 18n,
        graduationTarget: networkConfig.launchConfig.graduationThresholdWei,
        graduated: false,
      };
    }
  }

  // -------------------------------------------------------------------------
  // V1 graduation status (Uniswap V3 factory)
  // -------------------------------------------------------------------------
  async fetchGraduationStatus(
    tokenAddress: Address,
    networkConfig?: NetworkConfig,
  ): Promise<GraduationStatus> {
    const cfg = networkConfig ?? DEFAULT_NETWORK;
    const client = this.getClient(cfg);
    try {
      const [pairedPrincipal, threshold, graduated] = (await client.readContract({
        address: cfg.contracts.factory as Address,
        abi: launchpadFactoryAbi,
        functionName: 'graduationStatus',
        args: [tokenAddress],
      })) as [bigint, bigint, boolean];

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
        threshold: cfg.launchConfig.graduationThresholdWei,
        graduated: false,
        progress: 0,
      };
    }
  }

  async fetchPoolSlot0(poolAddress: Address): Promise<{ sqrtPriceX96: bigint; tick: number }> {
    // The pool can be on any chain: try each in registry order.
    for (const client of CHAINS.map((net) => this.getClient(net))) {
      try {
        const result = (await client.readContract({
          address: poolAddress,
          abi: uniswapV3PoolAbi,
          functionName: 'slot0',
        })) as unknown as [bigint, number, number, number, number, number, boolean];
        const sqrtPriceX96 = result[0];
        const tick = result[1];
        if (sqrtPriceX96 > 0n) return { sqrtPriceX96, tick };
      } catch {
        // Try next client
      }
    }
    return { sqrtPriceX96: 2505414483750479299401734n, tick: 0 };
  }

  async fetchWethBalance(account: Address): Promise<bigint> {
    try {
      return await this.getClient(DEFAULT_NETWORK).getBalance({ address: account });
    } catch {
      return 0n;
    }
  }
}
