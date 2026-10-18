import { describe, it, expect } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import { ROBINHOOD_CHAIN, type LaunchedTokenEntity } from '@goton/shared-types';
import { GraduationKeeperService } from '../src/modules/tokens/infrastructure/keeper/graduation-keeper.service';
import { InMemoryTokenRepository } from '../src/modules/tokens/infrastructure/adapters/in-memory-token.repository';

const FACTORY = '0x00000000000000000000000000000000000000fa' as const;
const network = {
  ...ROBINHOOD_CHAIN,
  contracts: {
    ...ROBINHOOD_CHAIN.contracts,
    factory: FACTORY,
    factoryV2: FACTORY,
    graduator: '0x00000000000000000000000000000000000000ab',
  },
} as typeof ROBINHOOD_CHAIN;

function curveToken(n: number, overrides: Partial<LaunchedTokenEntity> = {}): LaunchedTokenEntity {
  const address = `0x${n.toString(16).padStart(40, '0')}` as `0x${string}`;
  const curve = `0x${(n + 0x100).toString(16).padStart(40, '0')}` as `0x${string}`;
  return {
    address,
    name: 'T',
    symbol: 'T',
    decimals: 18,
    totalSupply: '1',
    logo: '',
    description: '',
    socials: {},
    deployer: address,
    pairedToken: ROBINHOOD_CHAIN.contracts.weth,
    poolAddress: curve,
    curveAddress: curve,
    isToken0: false,
    poolFee: 10_000,
    positionId: 0n,
    restrictionsEndBlock: 0n,
    launchBlock: 0n,
    createdAt: 0,
    version: 'v2',
    isGraduated: false,
    ...overrides,
  };
}

function setup(finishedCurves: string[], simulationReverts = false) {
  const writes: Array<{ args: readonly unknown[] }> = [];
  const publicClient = {
    readContract: async ({ address }: { address: string }) =>
      finishedCurves.includes(address.toLowerCase()),
    simulateContract: async ({ args }: { args: readonly unknown[] }) => {
      if (simulationReverts) throw new Error('UnknownToken()\ndetail');
      return { request: { functionName: 'graduate', args } };
    },
    waitForTransactionReceipt: async () => ({ status: 'success' }),
  } as unknown as PublicClient;
  const walletClient = {
    getAddresses: async () => ['0x00000000000000000000000000000000000000cc'],
    writeContract: async (req: { args: readonly unknown[] }) => {
      writes.push(req);
      return '0xhash';
    },
  } as unknown as WalletClient;
  return { publicClient, walletClient, writes };
}

describe('GraduationKeeperService', () => {
  it('graduates only curves that reached their target', async () => {
    const repo = new InMemoryTokenRepository();
    const done = curveToken(1);
    await repo.save(done);
    await repo.save(curveToken(2));
    const { publicClient, walletClient, writes } = setup([done.curveAddress!]);
    const results = await new GraduationKeeperService(
      publicClient,
      walletClient,
      repo,
      network,
    ).runOnce();
    expect(results).toEqual([{ token: done.address, executed: true, txHash: '0xhash' }]);
    expect(writes.map((w) => w.args)).toEqual([[done.address]]);
  });

  it('skips graduated, pool and other-chain tokens without reading them', async () => {
    const repo = new InMemoryTokenRepository();
    await repo.save(curveToken(1, { isGraduated: true }));
    await repo.save(curveToken(2, { version: 'v4' }));
    await repo.save(curveToken(3, { chainId: 5042 }));
    const all = [1, 2, 3].map((n) => curveToken(n).curveAddress!);
    const { publicClient, walletClient, writes } = setup(all);
    const results = await new GraduationKeeperService(
      publicClient,
      walletClient,
      repo,
      network,
    ).runOnce();
    expect(results).toEqual([]);
    expect(writes).toHaveLength(0);
  });

  it('sends nothing when the simulation reverts (older factory, already graduated)', async () => {
    const repo = new InMemoryTokenRepository();
    const done = curveToken(1);
    await repo.save(done);
    const { publicClient, walletClient, writes } = setup([done.curveAddress!], true);
    const [result] = await new GraduationKeeperService(
      publicClient,
      walletClient,
      repo,
      network,
    ).runOnce();
    expect(result).toMatchObject({ executed: false, reason: 'UnknownToken()' });
    expect(writes).toHaveLength(0);
  });

  it('does nothing where no graduator is deployed', async () => {
    const repo = new InMemoryTokenRepository();
    await repo.save(curveToken(1));
    const { publicClient, walletClient } = setup([curveToken(1).curveAddress!]);
    const results = await new GraduationKeeperService(publicClient, walletClient, repo, {
      ...network,
      contracts: { ...network.contracts, graduator: '0x0000000000000000000000000000000000000000' },
    } as typeof ROBINHOOD_CHAIN).runOnce();
    expect(results).toEqual([]);
  });
});
