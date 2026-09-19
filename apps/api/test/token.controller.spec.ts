import { describe, it, expect, beforeEach } from 'vitest';
import { TokenController } from '../src/modules/tokens/presentation/token.controller';
import { InMemoryTokenRepository } from '../src/modules/tokens/infrastructure/adapters/in-memory-token.repository';
import { GetTokensUseCase } from '../src/modules/tokens/application/use-cases/get-tokens.use-case';
import { GetTokenByAddressUseCase } from '../src/modules/tokens/application/use-cases/get-token-by-address.use-case';
import { CalculatePricingUseCase } from '../src/modules/tokens/application/use-cases/calculate-pricing.use-case';
import { CoinGeckoPriceFeedAdapter } from '../src/modules/tokens/infrastructure/adapters/coingecko-price-feed.adapter';
import type { ViemChainIndexerAdapter } from '../src/modules/tokens/infrastructure/adapters/viem-chain-indexer.adapter';
import type { LaunchedTokenEntity } from '@proto/shared-types';

// Minimal partial mock — only the methods called by GetTokenByAddressUseCase
const fakeChainIndexer = {
  async fetchLaunchedTokenFromChain(address: `0x${string}`): Promise<LaunchedTokenEntity | null> {
    return {
      address,
      name: 'Indexer Token',
      symbol: 'INDX',
      decimals: 18,
      totalSupply: '1000000000000000000000000000',
      logo: 'ipfs://indx',
      description: 'Indexed token',
      socials: { twitter: 'twitter.com/indx' },
      deployer: '0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2',
      pairedToken: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
      poolAddress: '0x2222222222222222222222222222222222222222',
      isToken0: true,
      poolFee: 10000,
      positionId: 1n,
      restrictionsEndBlock: 100n,
      launchBlock: 98n,
      createdAt: Date.now(),
      version: 'v1',
    };
  },
  async fetchV2CurveState() {
    return {
      totalEthRaised: 0n,
      virtualEthReserve: 3n * 10n ** 18n,
      virtualTokenReserve: 1_000_000_000n * 10n ** 18n,
      graduationTarget: 4_200n * 10n ** 15n,
      graduated: false,
    };
  },
  async fetchGraduationStatus(_tokenAddress: `0x${string}`) {
    return { pairedPrincipal: 0n, threshold: 4200000000000000000n, graduated: false, progress: 0 };
  },
  async fetchPoolSlot0(_poolAddress: `0x${string}`) {
    return { sqrtPriceX96: 1000000000000000000000000n, tick: 0 };
  },
  async fetchWethBalance(_account: `0x${string}`) {
    return 0n;
  },
} satisfies Partial<ViemChainIndexerAdapter>;

describe('TokenController Unit Tests', () => {
  let repository: InMemoryTokenRepository;
  let controller: TokenController;
  const testAddress = '0x1234567890123456789012345678901234567890' as `0x${string}`;

  beforeEach(() => {
    repository = new InMemoryTokenRepository();
    const calculatePricing = new CalculatePricingUseCase();
    const priceFeed = new CoinGeckoPriceFeedAdapter({ initialPrice: 2500 });
    const getTokensUseCase = new GetTokensUseCase(repository);
    const getTokenByAddressUseCase = new GetTokenByAddressUseCase(
      repository,
      fakeChainIndexer as unknown as ViemChainIndexerAdapter,
      calculatePricing,
      priceFeed,
    );
    controller = new TokenController(
      getTokensUseCase,
      getTokenByAddressUseCase,
      repository,
      priceFeed,
    );
  });

  it('rejects invalid address format for token detail, holders, and trades', async () => {
    const invalid = '0x123';
    const resDetail = await controller.getToken(invalid);
    expect(resDetail.success).toBe(false);
    expect(resDetail.error?.code).toBe('INVALID_ADDRESS');

    const resHolders = await controller.getHolders(invalid);
    expect(resHolders.success).toBe(false);
    expect(resHolders.error?.code).toBe('INVALID_ADDRESS');

    const resTrades = await controller.getTrades(invalid);
    expect(resTrades.success).toBe(false);
    expect(resTrades.error?.code).toBe('INVALID_ADDRESS');
  });

  it('returns TOKEN_NOT_FOUND when token not found in repo or chain', async () => {
    // Override mock to return null from both Robinhood and Arc
    const nullChainIndexer = {
      ...fakeChainIndexer,
      async fetchLaunchedTokenFromChain() {
        return null;
      },
    } satisfies Partial<ViemChainIndexerAdapter>;

    const nullUseCase = new GetTokenByAddressUseCase(
      repository,
      nullChainIndexer as unknown as ViemChainIndexerAdapter,
      new CalculatePricingUseCase(),
      new CoinGeckoPriceFeedAdapter({ initialPrice: 2500 }),
    );
    const nullController = new TokenController(
      new GetTokensUseCase(repository),
      nullUseCase,
      repository,
      new CoinGeckoPriceFeedAdapter({ initialPrice: 2500 }),
    );

    const res = await nullController.getToken(testAddress);
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('TOKEN_NOT_FOUND');
  });

  it('getTokens returns empty list when no tokens in repo', async () => {
    const res = await controller.listTokens();
    expect(res.success).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data?.length).toBe(0);
  });

  it('getTopTraders returns structured result for valid address', async () => {
    const res = await controller.getTopTraders(testAddress);
    expect(res.success).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('getTrades returns empty list for unknown address', async () => {
    const res = await controller.getTrades(testAddress);
    expect(res.success).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('getCandlesticks validates resolution param', async () => {
    const res = await controller.getCandlesticks(testAddress, 999);
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('INVALID_RESOLUTION');
  });

  it('getCandlesticks returns array for valid resolution', async () => {
    const res = await controller.getCandlesticks(testAddress, 60);
    expect(res.success).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
  });
});
