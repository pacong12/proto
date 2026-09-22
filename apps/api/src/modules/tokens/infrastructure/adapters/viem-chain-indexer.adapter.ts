import { createPublicClient, http, PublicClient, type Address, type Chain } from 'viem';
import {
  LaunchedTokenEntity,
  GraduationStatus,
  ROBINHOOD_CHAIN,
  ARC_CHAIN,
  launchpadFactoryAbi,
  launchpadTokenAbi,
  uniswapV3PoolAbi,
  type NetworkConfig,
} from '@proto/shared-types';
import { ChainIndexerPort } from '../../domain/ports/chain.indexer.port';

// ---------------------------------------------------------------------------
// Minimal ABI fragments for V2 BondingCurve reads
// ---------------------------------------------------------------------------
const bondingCurveAbi = [
  {
    name: 'totalEthRaised',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'virtualEthReserve',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'virtualTokenReserve',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'graduationTarget',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'graduated',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'creator',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const;

// V2 Factory ABI fragments for getLaunch lookup
// Reserved for future factory readContract calls
const _factoryV2Abi = [
  {
    name: 'launches',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [
      { name: 'token', type: 'address' },
      { name: 'curve', type: 'address' },
      { name: 'creator', type: 'address' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'graduated', type: 'bool' },
    ],
  },
] as const;

// V2 token ABI — only fields emitted by LaunchpadToken (name/symbol/logo etc.)
const launchpadTokenV2Abi = [
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'logo',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'description',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'socials',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'twitter', type: 'string' },
      { name: 'telegram', type: 'string' },
      { name: 'discord', type: 'string' },
      { name: 'website', type: 'string' },
      { name: 'farcaster', type: 'string' },
    ],
  },
] as const;

function makeViemChain(cfg: NetworkConfig): Chain {
  return {
    id: cfg.chainId,
    name: cfg.name,
    nativeCurrency: cfg.nativeCurrency,
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
  };
}

export class ViemChainIndexerAdapter implements ChainIndexerPort {
  private readonly robinhoodClient: PublicClient;
  private readonly arcClient: PublicClient;

  constructor() {
    this.robinhoodClient = createPublicClient({
      chain: makeViemChain(ROBINHOOD_CHAIN),
      transport: http(ROBINHOOD_CHAIN.rpcUrl),
    });
    this.arcClient = createPublicClient({
      chain: makeViemChain(ARC_CHAIN),
      transport: http(ARC_CHAIN.rpcUrl),
    });
  }

  /**
   * Resolve the correct viem client and network config for a given token.
   * Detection strategy: check against ARC_CHAIN factory / weth addresses.
   */
  private resolveNetwork(
    pairedToken?: string,
    poolAddress?: string,
  ): { client: PublicClient; network: NetworkConfig } {
    const arcWeth = ARC_CHAIN.contracts.weth.toLowerCase();
    const arcFactory = ARC_CHAIN.contracts.factory.toLowerCase();
    const arcFactoryV2 = (
      ARC_CHAIN.contracts.factoryV2 ?? ARC_CHAIN.contracts.factory
    ).toLowerCase();

    const pt = (pairedToken ?? '').toLowerCase();
    const pa = (poolAddress ?? '').toLowerCase();

    const isArc = pt === arcWeth || pa === arcFactory || pa === arcFactoryV2;

    return isArc
      ? { client: this.arcClient, network: ARC_CHAIN }
      : { client: this.robinhoodClient, network: ROBINHOOD_CHAIN };
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
    const client =
      networkConfig.chainId === ARC_CHAIN.chainId ? this.arcClient : this.robinhoodClient;

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
      ] = await Promise.all([
        client.readContract({
          address: tokenAddress,
          abi: launchpadTokenV2Abi,
          functionName: 'name',
        }),
        client.readContract({
          address: tokenAddress,
          abi: launchpadTokenV2Abi,
          functionName: 'symbol',
        }),
        client.readContract({
          address: tokenAddress,
          abi: launchpadTokenV2Abi,
          functionName: 'decimals',
        }),
        client.readContract({
          address: tokenAddress,
          abi: launchpadTokenV2Abi,
          functionName: 'totalSupply',
        }),
        client
          .readContract({ address: tokenAddress, abi: launchpadTokenV2Abi, functionName: 'logo' })
          .catch(() => ''),
        client
          .readContract({
            address: tokenAddress,
            abi: launchpadTokenV2Abi,
            functionName: 'description',
          })
          .catch(() => ''),
        client
          .readContract({
            address: tokenAddress,
            abi: launchpadTokenV2Abi,
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
      ]);

      const [twitter, telegram, discord, website, farcaster] = socialsRaw as string[];

      return {
        address: tokenAddress,
        name: name as string,
        symbol: symbol as string,
        decimals: decimals as number,
        totalSupply: (totalSupply as bigint).toString(),
        logo: (logo as string) || '',
        description: (description as string) || '',
        socials: { twitter, telegram, discord, website, farcaster },
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
    } catch (err) {
      console.error(`[ChainIndexer] fetchV2LaunchedToken failed for ${tokenAddress}:`, err);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // V1 pool token indexer (Uniswap V3 pool-based launches)
  // -------------------------------------------------------------------------
  async fetchLaunchedTokenFromChain(
    tokenAddress: Address,
    networkConfig?: NetworkConfig,
  ): Promise<LaunchedTokenEntity | null> {
    const cfg = networkConfig ?? ROBINHOOD_CHAIN;
    const client = cfg.chainId === ARC_CHAIN.chainId ? this.arcClient : this.robinhoodClient;

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
    } catch (err) {
      console.error(`[ChainIndexer] fetchLaunchedTokenFromChain failed for ${tokenAddress}:`, err);
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
    const client =
      networkConfig.chainId === ARC_CHAIN.chainId ? this.arcClient : this.robinhoodClient;
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
      return {
        totalEthRaised: 0n,
        virtualEthReserve:
          networkConfig.chainId === ARC_CHAIN.chainId ? 4_200n * 10n ** 18n : 3n * 10n ** 18n,
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
    const cfg = networkConfig ?? ROBINHOOD_CHAIN;
    const client = cfg.chainId === ARC_CHAIN.chainId ? this.arcClient : this.robinhoodClient;
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
    // Try Robinhood first, then Arc
    for (const client of [this.robinhoodClient, this.arcClient]) {
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
      return await this.robinhoodClient.getBalance({ address: account });
    } catch {
      return 0n;
    }
  }
}
