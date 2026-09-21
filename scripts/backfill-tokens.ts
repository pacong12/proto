/**
 * Backfill historical V2 TokenLaunched events from the Arc and Robinhood factories.
 *
 * Usage:
 *   bun run --env-file=.env scripts/backfill-tokens.ts [--chain arc|robinhood] [--from <block>] [--to <block>]
 *
 * Scans in batches of 500 blocks (safe for public RPC nodes).
 * Already-indexed tokens are skipped automatically (findByAddress check).
 * Progress is printed every 10 batches.
 */

import { createPublicClient, http, parseAbiItem } from 'viem';
import { Database } from 'bun:sqlite';
import { ARC_CHAIN, ROBINHOOD_CHAIN } from '../packages/shared-types/src/constants/network';
import { SqliteTokenRepository } from '../apps/api/src/modules/tokens/infrastructure/adapters/sqlite-token.repository';
import { ViemChainIndexerAdapter } from '../apps/api/src/modules/tokens/infrastructure/adapters/viem-chain-indexer.adapter';

const BATCH_SIZE = 500n;

const TOKEN_LAUNCHED_EVENT = parseAbiItem(
  'event TokenLaunched(address indexed token, address indexed curve, address indexed creator, address pairedToken, uint256 positionId, uint256 initialBuyAmount)',
);

async function backfill(opts: {
  chainName: 'arc' | 'robinhood';
  fromBlock: bigint;
  toBlock: bigint;
}) {
  const network = opts.chainName === 'arc' ? ARC_CHAIN : ROBINHOOD_CHAIN;
  const factoryV2 = network.contracts.factoryV2 ?? network.contracts.factory;

  const client = createPublicClient({
    chain: {
      id: network.chainId,
      name: network.name,
      nativeCurrency: network.nativeCurrency,
      rpcUrls: { default: { http: [network.rpcUrl] } },
    } as Parameters<typeof createPublicClient>[0]['chain'],
    transport: http(network.rpcUrl, { retryCount: 1, timeout: 15_000 }),
  });

  const db = new Database('apps/api/proto.sqlite');
  const repository = new SqliteTokenRepository(db);
  const chainIndexer = new ViemChainIndexerAdapter();

  console.log(`[Backfill] Chain: ${network.name}`);
  console.log(`[Backfill] Factory V2: ${factoryV2}`);
  console.log(`[Backfill] Block range: ${opts.fromBlock} -> ${opts.toBlock}`);
  console.log(`[Backfill] Batch size: ${BATCH_SIZE}`);

  let totalNew = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let batch = 0;
  let from = opts.fromBlock;

  while (from <= opts.toBlock) {
    const to = from + BATCH_SIZE - 1n < opts.toBlock ? from + BATCH_SIZE - 1n : opts.toBlock;
    batch++;

    try {
      const logs = await client.getLogs({
        address: factoryV2 as `0x${string}`,
        event: TOKEN_LAUNCHED_EVENT,
        fromBlock: from,
        toBlock: to,
      });

      for (const log of logs) {
        const tokenAddress = log.args.token as `0x${string}`;
        const curveAddress = log.args.curve as `0x${string}`;
        if (!tokenAddress || !curveAddress) continue;

        const existing = await repository.findByAddress(tokenAddress);
        if (existing) {
          totalSkipped++;
          continue;
        }

        try {
          const entity = await chainIndexer.fetchV2LaunchedToken(
            tokenAddress,
            curveAddress,
            network,
          );
          if (entity) {
            await repository.save({ ...entity, version: 'v2', curveAddress });
            totalNew++;
          } else {
            totalFailed++;
          }
        } catch {
          totalFailed++;
        }
      }
    } catch (e) {
      console.warn(`[Backfill] Batch ${batch} (${from}-${to}) error: ${(e as Error).message}`);
    }

    if (batch % 10 === 0) {
      const pct = (((from - opts.fromBlock) * 100n) / (opts.toBlock - opts.fromBlock + 1n))
        .toString()
        .padStart(3);
      console.log(
        `[Backfill] ${pct}% | block ${from} | new: ${totalNew} | skip: ${totalSkipped} | fail: ${totalFailed}`,
      );
    }

    from = to + 1n;
  }

  console.log(`\n[Backfill] Done.`);
  console.log(`  New tokens indexed : ${totalNew}`);
  console.log(`  Already in DB      : ${totalSkipped}`);
  console.log(`  Fetch failed       : ${totalFailed}`);
  db.close();
}

// Parse CLI args
const args = process.argv.slice(2);
const chainArg = args[args.indexOf('--chain') + 1] ?? 'arc';
const fromArg = args[args.indexOf('--from') + 1];
const toArg = args[args.indexOf('--to') + 1];

// Default: scan from the earliest known V2 deployment blocks
const defaultFrom: Record<string, bigint> = {
  arc: 62_000_000n,
  robinhood: 68_000_000n,
};

const chainName = chainArg === 'robinhood' ? 'robinhood' : 'arc';
const client = createPublicClient({
  chain: {
    id: (chainName === 'arc' ? ARC_CHAIN : ROBINHOOD_CHAIN).chainId,
    name: chainName,
    nativeCurrency: (chainName === 'arc' ? ARC_CHAIN : ROBINHOOD_CHAIN).nativeCurrency,
    rpcUrls: {
      default: { http: [(chainName === 'arc' ? ARC_CHAIN : ROBINHOOD_CHAIN).rpcUrl] },
    },
  } as Parameters<typeof createPublicClient>[0]['chain'],
  transport: http((chainName === 'arc' ? ARC_CHAIN : ROBINHOOD_CHAIN).rpcUrl, {
    retryCount: 0,
    timeout: 15_000,
  }),
});

const currentBlock = await client.getBlockNumber();
const fromBlock = fromArg ? BigInt(fromArg) : defaultFrom[chainName];
const toBlock = toArg ? BigInt(toArg) : currentBlock;

await backfill({ chainName, fromBlock, toBlock });
