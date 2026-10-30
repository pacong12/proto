import { describe, expect, it } from 'vitest';
import type { PublicClient } from 'viem';
import { ARC_CHAIN, ROBINHOOD_CHAIN, type LaunchedTokenEntity } from '@goton/shared-types';
import { EventPollerService } from '../src/modules/tokens/infrastructure/indexer/event-poller.service';
import { SqliteTokenRepository } from '../src/modules/tokens/infrastructure/adapters/sqlite-token.repository';

const TOKEN = '0x00000000000000000000000000000000000000aa' as const;
const CURVE = '0x00000000000000000000000000000000000000c0' as const;
const ALICE = '0x00000000000000000000000000000000000000a1' as const;
const BOB = '0x00000000000000000000000000000000000000b0' as const;
const DEAD = '0x00000000000000000000000000000000000000de' as const;
const ZERO = '0x0000000000000000000000000000000000000000' as const;
const POOL_MANAGER = ROBINHOOD_CHAIN.contracts.poolManagerV4!.toLowerCase() as `0x${string}`;
const E18 = 10n ** 18n;

const token = {
  address: TOKEN,
  name: 'T',
  symbol: 'T',
  decimals: 18,
  totalSupply: (1_000_000_000n * E18).toString(),
  logo: '',
  description: '',
  socials: {},
  deployer: ALICE,
  pairedToken: ROBINHOOD_CHAIN.contracts.weth,
  poolAddress: CURVE,
  curveAddress: CURVE,
  isToken0: false,
  poolFee: 10000,
  positionId: 0n,
  restrictionsEndBlock: 0n,
  launchBlock: 0n,
  createdAt: 0,
  version: 'v2',
  chainId: ROBINHOOD_CHAIN.chainId,
} as unknown as LaunchedTokenEntity;

const transfer = (from: `0x${string}`, to: `0x${string}`) => ({
  address: TOKEN,
  args: { from, to },
});

function setup(balances: Record<string, bigint>) {
  const repo = new SqliteTokenRepository(':memory:');
  const getLogsRanges: Array<[bigint, bigint]> = [];
  const client = {
    getBlockNumber: async () => 1_000n,
    getBlock: async () => ({ timestamp: 1n }),
    getLogs: async ({
      event,
      fromBlock,
      toBlock,
    }: {
      event?: { name: string };
      fromBlock: bigint;
      toBlock: bigint;
    }) => {
      if (event?.name !== 'Transfer') return [];
      getLogsRanges.push([fromBlock, toBlock]);
      // Mint to the factory, the factory funds the curve, Alice buys, then sends some to Bob
      // (who never trades), and the curve's last tokens move to the PoolManager.
      return [
        transfer(ZERO, ALICE),
        transfer(ALICE, CURVE),
        transfer(CURVE, ALICE),
        transfer(ALICE, BOB),
        transfer(CURVE, POOL_MANAGER),
      ];
    },
    // DEAD has no contract on this chain (a testnet leftover in the database).
    getCode: async ({ address }: { address: string }) =>
      address.toLowerCase() === DEAD ? undefined : '0x6080',
    readContract: async ({
      address,
      functionName,
      args,
    }: {
      address: string;
      functionName: string;
      args?: [string];
    }) => {
      if (address.toLowerCase() === DEAD) throw new Error('execution reverted');
      if (functionName === 'launchBlock') return 500n;
      if (functionName === 'balanceOf') return balances[args![0].toLowerCase()] ?? 0n;
      return 18;
    },
  } as unknown as PublicClient;
  const poller = new EventPollerService(
    client,
    repo,
    {} as never,
    {} as never,
    { getQuoteAssetPriceUsd: async () => 2400 } as never,
    ROBINHOOD_CHAIN,
  );
  return { repo, poller, getLogsRanges };
}

describe('holders from Transfer logs', () => {
  it('records every holder on chain, including one that only received a transfer', async () => {
    const { repo, poller, getLogsRanges } = setup({
      [ALICE]: 100_000_000n * E18,
      [BOB]: 50_000_000n * E18,
      [CURVE]: 0n,
      [POOL_MANAGER]: 850_000_000n * E18,
    });
    await repo.save(token);
    await poller.pollEvents(900n, 949n);

    // The first sight of the token reads its history from its on-chain launch block.
    expect(getLogsRanges[0][0]).toBe(500n);
    const holders = await repo.getHolders(TOKEN, 10);
    expect(holders.map((h) => [h.address, h.percent])).toEqual([
      [CURVE, 85], // the PoolManager's balance, shown under the token's pool address
      [ALICE, 10],
      [BOB, 5],
    ]);
  });

  it('gives the same balances when a range is indexed again', async () => {
    const { repo, poller } = setup({ [ALICE]: 7n * E18, [BOB]: 3n * E18 });
    await repo.save(token);
    await poller.pollEvents(900n, 949n);
    await poller.pollEvents(900n, 949n);
    const holders = await repo.getHolders(TOKEN, 10);
    expect(holders.map((h) => h.balance)).toEqual([(7n * E18).toString(), (3n * E18).toString()]);
  });

  it('does not let an address without a contract block the next token', async () => {
    const { repo, poller } = setup({ [ALICE]: 7n * E18 });
    await repo.save(token);
    // Saved last, so listed first: the dead address is the first backfill tried.
    await repo.save({ ...token, address: DEAD } as LaunchedTokenEntity);
    await poller.pollEvents(900n, 949n);
    await poller.pollEvents(950n, 999n);
    expect(await repo.getHolderIndexedTokens()).toEqual(new Set([DEAD, TOKEN]));
    expect(await repo.getHolders(DEAD, 10)).toEqual([]);
    expect((await repo.getHolders(TOKEN, 10)).map((h) => h.address)).toEqual([ALICE]);
  });

  it('skips tokens of another chain', async () => {
    const { repo, poller, getLogsRanges } = setup({});
    // The repository keeps no chain id; an Arc token is recognised by its USDC quote.
    await repo.save({
      ...token,
      pairedToken: ARC_CHAIN.contracts.weth,
      version: 'v4',
    } as LaunchedTokenEntity);
    await poller.pollEvents(900n, 949n);
    expect(getLogsRanges).toHaveLength(0);
  });
});
