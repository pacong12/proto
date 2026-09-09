import { describe, it, expect, beforeEach } from 'vitest';
import { TokenController } from '../src/modules/tokens/presentation/token.controller';
import { InMemoryTokenRepository } from '../src/modules/tokens/infrastructure/adapters/in-memory-token.repository';
import { GetTokensUseCase } from '../src/modules/tokens/application/use-cases/get-tokens.use-case';
import { GetTokenByAddressUseCase } from '../src/modules/tokens/application/use-cases/get-token-by-address.use-case';
import { CalculatePricingUseCase } from '../src/modules/tokens/application/use-cases/calculate-pricing.use-case';
import type { ChainIndexerPort } from '../src/modules/tokens/domain/ports/chain.indexer.port';
import type { LaunchedTokenEntity } from '@proto/shared-types';

class FakeChainIndexer implements ChainIndexerPort {
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
      version: 'v2',
    };
  }
  async fetchGraduationStatus(_tokenAddress: `0x${string}`) {
    return { pairedPrincipal: 0n, threshold: 4200000000000000000n, graduated: false, progress: 0 };
  }
  async fetchPoolSlot0(_poolAddress: `0x${string}`) {
    return { sqrtPriceX96: 1000000000000000000000000n, tick: 0 };
  }
  async fetchWethBalance(_account: `0x${string}`) {
    return 0n;
  }
}

describe('TokenController Unit Tests', () => {
  let repository: InMemoryTokenRepository;
  let controller: TokenController;
  const testAddress = '0x1234567890123456789012345678901234567890' as `0x${string}`;

  beforeEach(() => {
    repository = new InMemoryTokenRepository();
    const chainIndexer = new FakeChainIndexer();
    const calculatePricing = new CalculatePricingUseCase();
    const getTokensUseCase = new GetTokensUseCase(repository);
    const getTokenByAddressUseCase = new GetTokenByAddressUseCase(
      repository,
      chainIndexer,
      calculatePricing,
    );
    controller = new TokenController(getTokensUseCase, getTokenByAddressUseCase, repository);
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

    const resTopTraders = await controller.getTopTraders(invalid);
    expect(resTopTraders.success).toBe(false);
    expect(resTopTraders.error?.code).toBe('INVALID_ADDRESS');

    const resDev = await controller.getDevActivity(invalid);
    expect(resDev.success).toBe(false);
    expect(resDev.error?.code).toBe('INVALID_ADDRESS');
  });

  it('fetches and filters tokens by version and deployer', async () => {
    await repository.save({
      address: testAddress,
      name: 'Alpha Token',
      symbol: 'ALPHA',
      decimals: 18,
      totalSupply: '1000000000000000000000000000',
      logo: 'ipfs://alpha',
      description: 'Alpha token',
      socials: {},
      deployer: '0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2',
      pairedToken: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
      poolAddress: '0x3333333333333333333333333333333333333333',
      isToken0: true,
      poolFee: 10000,
      positionId: 1n,
      restrictionsEndBlock: 100n,
      launchBlock: 98n,
      createdAt: Date.now(),
      version: 'v2',
    });

    const resAll = await controller.listTokens(10, 0);
    expect(resAll.success).toBe(true);
    expect(resAll.data?.length).toBe(1);

    const resV2 = await controller.listTokens(10, 0, 'v2');
    expect(resV2.data?.length).toBe(1);

    const resV1 = await controller.listTokens(10, 0, 'v1');
    expect(resV1.data?.length).toBe(0);

    const resDeployerMatch = await controller.listTokens(
      10,
      0,
      undefined,
      '0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2',
    );
    expect(resDeployerMatch.data?.length).toBe(1);

    const resDeployerOther = await controller.listTokens(
      10,
      0,
      undefined,
      '0x0000000000000000000000000000000000000000',
    );
    expect(resDeployerOther.data?.length).toBe(0);
  });

  it('calculates top traders ranking and dev activity correctly', async () => {
    await repository.save({
      address: testAddress,
      name: 'Trade Token',
      symbol: 'TRD',
      decimals: 18,
      totalSupply: '1000000000000000000000000000',
      logo: 'ipfs://trd',
      description: 'Trade token',
      socials: {},
      deployer: '0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2',
      pairedToken: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
      poolAddress: '0x3333333333333333333333333333333333333333',
      isToken0: true,
      poolFee: 10000,
      positionId: 1n,
      restrictionsEndBlock: 100n,
      launchBlock: 98n,
      createdAt: Date.now(),
      version: 'v1',
      initialBuyAmount: '50000000000000000000000000',
    });

    const traderA = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    await repository.saveTrade({
      id: 'trade-1',
      tokenAddress: testAddress,
      poolAddress: '0x3333333333333333333333333333333333333333',
      trader: traderA,
      isBuy: true,
      tokenAmount: '1000000000000000000000',
      wethAmount: '0.1',
      priceUsd: 250,
      blockNumber: 100n,
      transactionHash: '0xabc',
      timestamp: Date.now() - 10000,
    });
    const topTradersRes = await controller.getTopTraders(testAddress, 10);
    expect(topTradersRes.success).toBe(true);
    expect(topTradersRes.data?.length).toBeGreaterThanOrEqual(1);
    expect(topTradersRes.data?.[0].address).toBe(traderA.toLowerCase());
    expect(topTradersRes.data?.[0].positionStatus).toBe('holding');

    const devRes = await controller.getDevActivity(testAddress);
    expect(devRes.success).toBe(true);
    expect(devRes.data?.creatorAddress).toBe('0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2');
  });
});
