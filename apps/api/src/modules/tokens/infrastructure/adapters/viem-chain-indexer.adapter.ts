import { createPublicClient, http, PublicClient, type Address } from 'viem';
import {
  LaunchedTokenEntity,
  GraduationStatus,
  CHAINS,
  DEFAULT_NETWORK,
  launchpadFactoryAbi,
  launchpadV2FactoryAbi,
  launchpadTokenAbi,
  bondingCurveAbi,
  uniswapV3PoolAbi,
  resolveTokenNetwork,
  toViemChain,
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

  /**
   * Resolve the correct viem client and network config for a given token.
   * Scalable: leverages resolveTokenNetwork across all registered chains.
   */
  private resolveNetwork(
    pairedToken?: string,
    poolAddress?: string,
    curveAddress?: string,
    chainId?: number,
  ): { client: PublicClient; network: NetworkConfig } {
    const network = resolveTokenNetwork(
      { pairedToken, poolAddress, curveAddress, chainId },
      chainId,
    );
    return { client: this.getClient(network), network };
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
    const client = this.getClient(networkConfig);

    try {
      const [
        name,
        symbol,
        decimals,
        totalSupply,
        logo,
        description,
        socialsRaw,
        totalEthRaised,
        virtualEthReserve,
        virtualTokenReserve,
        graduationTarget,
        graduated,
        creator,
        taxRaw,
        pendingRaw,
      ] = await Promise.all([
        client.readContract({
          address: tokenAddress,
          abi: launchpadTokenAbi,
          functionName: 'name',
        }),
        client.readContract({
          address: tokenAddress,
          abi: launchpadTokenAbi,
          functionName: 'symbol',
        }),
        client.readContract({
          address: tokenAddress,
          abi: launchpadTokenAbi,
          functionName: 'decimals',
        }),
        client.readContract({
          address: tokenAddress,
          abi: launchpadTokenAbi,
          functionName: 'totalSupply',
        }),
        client
          .readContract({ address: tokenAddress, abi: launchpadTokenAbi, functionName: 'logo' })
          .catch(() => ''),
        client
          .readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'description',
          })
          .catch(() => ''),
        client
          .readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'socials',
          })
          .catch(() => ['', '', '', '', '']),
        client.readContract({
          address: curveAddress,
          abi: bondingCurveAbi,
          functionName: 'totalEthRaised',
        }),
        client.readContract({
          address: curveAddress,
          abi: bondingCurveAbi,
          functionName: 'virtualEthReserve',
        }),
        client.readContract({
          address: curveAddress,
          abi: bondingCurveAbi,
          functionName: 'virtualTokenReserve',
        }),
        client.readContract({
          address: curveAddress,
          abi: bondingCurveAbi,
          functionName: 'graduationTarget',
        }),
        client.readContract({
          address: curveAddress,
          abi: bondingCurveAbi,
          functionName: 'graduated',
        }),
        client.readContract({
          address: curveAddress,
          abi: bondingCurveAbi,
          functionName: 'creator',
        }),
        client
          .readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'taxConfig',
          })
          .catch(() => [0, 0, '0x0000000000000000000000000000000000000000'] as const),
        client
          .readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'pendingTaxConfig',
          })
          .catch(() => [0, 0, '0x0000000000000000000000000000000000000000', 0n] as const),
      ]);

      const [twitter, telegram, discord, website, farcaster] = socialsRaw as string[];

      const buyTaxBps = Number(taxRaw[0]) || Number(pendingRaw[0]) || undefined;
      const sellTaxBps = Number(taxRaw[1]) || Number(pendingRaw[1]) || undefined;
      const taxRecipient =
        taxRaw[2] !== '0x0000000000000000000000000000000000000000'
          ? (taxRaw[2] as `0x${string}`)
          : pendingRaw[2] !== '0x0000000000000000000000000000000000000000'
            ? (pendingRaw[2] as `0x${string}`)
            : undefined;

      const taxConfig =
        buyTaxBps !== undefined || sellTaxBps !== undefined || taxRecipient
          ? { buyTaxBps, sellTaxBps, taxRecipient }
          : undefined;

      return {
        address: tokenAddress,
        name: name as string,
        symbol: symbol as string,
        decimals: decimals as number,
        totalSupply: (totalSupply as bigint).toString(),
        logo: (logo as string) || '',
        description: (description as string) || '',
        socials: { twitter, telegram, discord, website, farcaster },
        taxConfig,
        deployer: creator as `0x${string}`,
        pairedToken: networkConfig.contracts.weth as `0x${string}`,
        poolAddress: curveAddress as `0x${string}`,
        isToken0: false, // V2 bonding curve: N/A
        poolFee: networkConfig.launchConfig.poolFee,
        positionId: 0n,
        restrictionsEndBlock: 0n,
        launchBlock: 0n,
        createdAt: Date.now(),
        initialBuyAmount: totalEthRaised.toString(),
        version: 'v2',
        curveAddress,
        // V2 on-chain parameters — stored for pricing without additional RPC calls
        virtualEthReserve: virtualEthReserve.toString(),
        virtualTokenReserve: virtualTokenReserve.toString(),
        graduationTarget: graduationTarget.toString(),
        isGraduated: graduated as boolean,
      };
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
    const client = this.getClient(networkConfig);
    try {
      const [name, symbol, decimals, totalSupply, logo, description, socialsRaw] =
        await Promise.all([
          client.readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'name',
          }),
          client.readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'symbol',
          }),
          client.readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'decimals',
          }),
          client.readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'totalSupply',
          }),
          client
            .readContract({ address: tokenAddress, abi: launchpadTokenAbi, functionName: 'logo' })
            .catch(() => ''),
          client
            .readContract({
              address: tokenAddress,
              abi: launchpadTokenAbi,
              functionName: 'description',
            })
            .catch(() => ''),
          client
            .readContract({
              address: tokenAddress,
              abi: launchpadTokenAbi,
              functionName: 'socials',
            })
            .catch(() => ['', '', '', '', ''] as const),
        ]);
      const [twitter, telegram, discord, website, farcaster] = socialsRaw as readonly string[];
      const quote = networkConfig.contracts.weth;

      return {
        address: tokenAddress,
        name: name as string,
        symbol: symbol as string,
        decimals: decimals as number,
        totalSupply: (totalSupply as bigint).toString(),
        logo: (logo as string) || '',
        description: (description as string) || '',
        socials: { twitter, telegram, discord, website, farcaster },
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
    const client = this.getClient(cfg);
    const factories = Array.from(
      new Set(
        [cfg.contracts.factoryV2, cfg.contracts.factory].filter((f): f is Address =>
          Boolean(f && f !== '0x0000000000000000000000000000000000000000'),
        ),
      ),
    );

    for (const factory of factories) {
      try {
        const launch = (await client.readContract({
          address: factory,
          abi: launchpadV2FactoryAbi,
          functionName: 'launches',
          args: [tokenAddress],
        })) as [Address, Address, Address, bigint, boolean];

        const curveAddress = launch[1];
        if (curveAddress && curveAddress !== '0x0000000000000000000000000000000000000000') {
          const entity = await this.fetchV2LaunchedToken(tokenAddress, curveAddress, cfg);
          if (entity) return entity;
        }
      } catch {
        // continue to next factory
      }
    }
    return null;
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
      const [tokenLaunchedData, name, symbol, decimals, logo, description, poolAddress, socials] =
        await Promise.all([
          client.readContract({
            address: cfg.contracts.factory as Address,
            abi: launchpadFactoryAbi,
            functionName: 'getLaunchedToken',
            args: [tokenAddress],
          }),
          client.readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'name',
          }),
          client.readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'symbol',
          }),
          client.readContract({
            address: tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'decimals',
          }),
          client
            .readContract({ address: tokenAddress, abi: launchpadTokenAbi, functionName: 'logo' })
            .catch(() => ''),
          client
            .readContract({
              address: tokenAddress,
              abi: launchpadTokenAbi,
              functionName: 'description',
            })
            .catch(() => ''),
          client
            .readContract({
              address: tokenAddress,
              abi: launchpadTokenAbi,
              functionName: 'liquidityPool',
            })
            .catch(() => '0x0000000000000000000000000000000000000000'),
          client
            .readContract({
              address: tokenAddress,
              abi: launchpadTokenAbi,
              functionName: 'socials',
            })
            .catch(() => ['', '', '', '', '']),
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

      const [twitter, telegram, discord, website, farcaster] = socials as string[];

      return {
        address: tokenAddress,
        name: name as string,
        symbol: symbol as string,
        decimals: decimals as number,
        totalSupply: td.supply.toString(),
        logo: (logo as string) || '',
        description: (description as string) || '',
        socials: { twitter, telegram, discord, website, farcaster },
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
  ): Promise<{
    totalEthRaised: bigint;
    virtualEthReserve: bigint;
    virtualTokenReserve: bigint;
    graduationTarget: bigint;
    graduated: boolean;
  }> {
    const client = this.getClient(networkConfig);
    try {
      const [totalEthRaised, virtualEthReserve, virtualTokenReserve, graduationTarget, graduated] =
        await Promise.all([
          client.readContract({
            address: curveAddress,
            abi: bondingCurveAbi,
            functionName: 'totalEthRaised',
          }),
          client.readContract({
            address: curveAddress,
            abi: bondingCurveAbi,
            functionName: 'virtualEthReserve',
          }),
          client.readContract({
            address: curveAddress,
            abi: bondingCurveAbi,
            functionName: 'virtualTokenReserve',
          }),
          client.readContract({
            address: curveAddress,
            abi: bondingCurveAbi,
            functionName: 'graduationTarget',
          }),
          client.readContract({
            address: curveAddress,
            abi: bondingCurveAbi,
            functionName: 'graduated',
          }),
        ]);
      return {
        totalEthRaised: totalEthRaised as bigint,
        virtualEthReserve: virtualEthReserve as bigint,
        virtualTokenReserve: virtualTokenReserve as bigint,
        graduationTarget: graduationTarget as bigint,
        graduated: graduated as boolean,
      };
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
