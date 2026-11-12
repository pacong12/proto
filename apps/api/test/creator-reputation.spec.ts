import { describe, expect, it } from 'vitest';
import {
  ROBINHOOD_CHAIN,
  type LaunchedTokenEntity,
  type TokenMarketData,
} from '@goton/shared-types';
import { SqliteTokenRepository } from '../src/app/storage/sqlite-token.repository';
import { GetCreatorReputationUseCase } from '../src/modules/tokens';

const CREATOR = '0x00000000000000000000000000000000000000c1';
const OTHER = '0x00000000000000000000000000000000000000d2';

const token = (n: number, deployer: string, over: Partial<LaunchedTokenEntity> = {}) =>
  ({
    address: `0x${n.toString(16).padStart(40, '0')}`,
    name: `T${n}`,
    symbol: `T${n}`,
    decimals: 18,
    totalSupply: '1000000000000000000000000000',
    logo: '',
    description: '',
    socials: {},
    deployer,
    pairedToken: ROBINHOOD_CHAIN.contracts.weth,
    poolAddress: `0x${n.toString(16).padStart(40, '0')}`,
    isToken0: false,
    poolFee: 10000,
    positionId: 0n,
    restrictionsEndBlock: 0n,
    launchBlock: 0n,
    createdAt: 0,
    version: 'v2',
    ...over,
  }) as unknown as LaunchedTokenEntity;

const market = (address: string, marketCapUsd: number, graduationProgress = 0): TokenMarketData =>
  ({
    address,
    priceInWeth: 1,
    priceUsd: 1,
    marketCapUsd,
    fdvUsd: marketCapUsd,
    pairedPrincipalWeth: '0',
    graduationThresholdWeth: '4.2',
    graduationProgress,
    isGraduated: graduationProgress >= 1,
    volume24hUsd: 0,
  }) as TokenMarketData;

describe('GetCreatorReputationUseCase', () => {
  it("summarizes a creator's launches, graduation rate and biggest token", async () => {
    const repo = new SqliteTokenRepository(':memory:');
    // Three by the creator (one graduated by flag, one by progress, one active) + one by another.
    await repo.save(token(1, CREATOR, { isGraduated: true }));
    await repo.save(token(2, CREATOR));
    await repo.save(token(3, CREATOR));
    await repo.save(token(9, OTHER));
    await repo.saveMarketData(market(token(1, CREATOR).address, 50_000));
    await repo.saveMarketData(market(token(2, CREATOR).address, 120_000, 1)); // graduated by progress
    await repo.saveMarketData(market(token(3, CREATOR).address, 30_000));
    await repo.saveMarketData(market(token(9, OTHER).address, 999_999, 1));

    const rep = await new GetCreatorReputationUseCase(repo).execute(
      CREATOR.toUpperCase().replace('0X', '0x'),
    );
    expect(rep.launches).toBe(3);
    expect(rep.graduated).toBe(2);
    expect(rep.active).toBe(1);
    expect(rep.graduationRate).toBeCloseTo(2 / 3, 6);
    expect(rep.totalMarketCapUsd).toBe(200_000);
    expect(rep.topToken).toMatchObject({
      address: token(2, CREATOR).address,
      marketCapUsd: 120_000,
    });
    repo.close();
  });

  it('returns a zero record for a wallet that never launched', async () => {
    const repo = new SqliteTokenRepository(':memory:');
    const rep = await new GetCreatorReputationUseCase(repo).execute(CREATOR);
    expect(rep).toMatchObject({
      launches: 0,
      graduated: 0,
      graduationRate: 0,
      totalMarketCapUsd: 0,
      topToken: null,
    });
    repo.close();
  });
});
