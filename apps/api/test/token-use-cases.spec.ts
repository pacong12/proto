import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryTokenRepository } from '../src/modules/tokens/infrastructure/adapters/in-memory-token.repository';
import { CalculatePricingUseCase } from '../src/modules/tokens/application/use-cases/calculate-pricing.use-case';
import { GetTokensUseCase } from '../src/modules/tokens/application/use-cases/get-tokens.use-case';
import { GetTokenByAddressUseCase } from '../src/modules/tokens/application/use-cases/get-token-by-address.use-case';
import { TokenController } from '../src/modules/tokens/presentation/token.controller';
import { ChainIndexerPort } from '../src/modules/tokens/domain/ports/chain.indexer.port';
import { LaunchedTokenEntity, GraduationStatus } from '@proto/shared-types';

class MockChainIndexer implements ChainIndexerPort {
  async fetchLaunchedTokenFromChain(address: `0x${string}`): Promise<LaunchedTokenEntity | null> {
    return {
      address,
      name: 'Mock Chain Token',
      symbol: 'MOCK',
      decimals: 18,
      totalSupply: '1000000000000000000000000000',
      logo: 'ipfs://mock',
      description: 'Fetched from chain indexer',
      socials: { twitter: 'https://x.com/mock' },
      deployer: '0x1111111111111111111111111111111111111111',
      pairedToken: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
      poolAddress: '0x2222222222222222222222222222222222222222',
      isToken0: true,
      poolFee: 10000,
      positionId: 1n,
      restrictionsEndBlock: 102n,
      launchBlock: 100n,
      createdAt: Date.now(),
    };
  }

  async fetchGraduationStatus(_tokenAddress: `0x${string}`): Promise<GraduationStatus> {
    return {
      pairedPrincipal: 1_000_000_000_000_000_000n,
      threshold: 4_200_000_000_000_000_000n,
      graduated: false,
      progress: 0.238,
    };
  }

  async fetchPoolSlot0(_poolAddress: `0x${string}`): Promise<{ sqrtPriceX96: bigint; tick: number }> {
    return {
      sqrtPriceX96: 2505414483750479299401734n,
      tick: 0,
    };
  }

  async fetchWethBalance(_account: `0x${string}`): Promise<bigint> {
    return 100n * 10n ** 18n;
  }
}

describe('Token Use Cases & Controller', () => {
  let repository: InMemoryTokenRepository;
  let chainIndexer: MockChainIndexer;
  let calculatePricing: CalculatePricingUseCase;
  let getTokensUseCase: GetTokensUseCase;
  let getTokenByAddressUseCase: GetTokenByAddressUseCase;
  let controller: TokenController;

  const sampleAddress = '0x39dBED3a2bd333467115dE45665cC57F813C4571' as `0x${string}`;

  beforeEach(() => {
    repository = new InMemoryTokenRepository();
    chainIndexer = new MockChainIndexer();
    calculatePricing = new CalculatePricingUseCase();
    getTokensUseCase = new GetTokensUseCase(repository);
    getTokenByAddressUseCase = new GetTokenByAddressUseCase(repository, chainIndexer, calculatePricing);
    controller = new TokenController(getTokensUseCase, getTokenByAddressUseCase);
  });

  it('fetches and indexes token from chain indexer when not in cache', async () => {
    const envelope = await controller.getToken(sampleAddress);

    expect(envelope.success).toBe(true);
    expect(envelope.data).not.toBeNull();
    expect(envelope.data?.token.name).toBe('Mock Chain Token');
    expect(envelope.data?.marketData.address).toBe(sampleAddress);

    // Verify it is cached in repository
    const cached = await repository.findByAddress(sampleAddress);
    expect(cached).not.toBeNull();
  });

  it('returns structured error envelope when invalid address format is provided', async () => {
    const envelope = await controller.getToken('invalid-address');

    expect(envelope.success).toBe(false);
    expect(envelope.error?.code).toBe('INVALID_ADDRESS');
    expect(envelope.data).toBeNull();
  });
});
