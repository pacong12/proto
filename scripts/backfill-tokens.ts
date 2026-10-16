/**
 * Re-index a block range after data loss (DR-06).
 *
 * Usage:
 *   bun run --env-file=.env scripts/backfill-tokens.ts --chain arc|robinhood --from <block> [--to <block>]
 *
 * Runs the API's own indexer (EventPollerService.indexRange) over the range, so launches, graduations,
 * trades and the market data derived from them (prices, volume, candles) are rebuilt exactly as the
 * live poller would have written them. Writes go to DB_PATH (default ./data/proto.sqlite). Saves are
 * upserts, so overlapping an already-indexed range is safe. The live poller's cursor is not moved.
 */

import { createPublicClient } from 'viem';
import { ARC_CHAIN, ROBINHOOD_CHAIN } from '../packages/shared-types/src/index';
import {
  SqliteTokenRepository,
  ViemChainIndexerAdapter,
  CalculatePricingUseCase,
  EventPollerService,
  CoinGeckoPriceFeedAdapter,
} from '../apps/api/src/index';
import { chainFor, rpcTransport } from '../apps/api/src/core/rpc';

const STEP = 50n; // same window as the live poller; keeps eth_getLogs within public RPC limits

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const chainName = arg('chain');
if (chainName !== 'arc' && chainName !== 'robinhood') {
  console.error('Usage: backfill-tokens.ts --chain arc|robinhood --from <block> [--to <block>]');
  process.exit(1);
}
const network = chainName === 'arc' ? ARC_CHAIN : ROBINHOOD_CHAIN;
const client = createPublicClient({
  chain: chainFor(network),
  transport: rpcTransport(network, 20_000),
});

const fromArg = arg('from');
if (!fromArg) {
  console.error('--from <block> is required (the factory deployment block is a good start).');
  process.exit(1);
}
const fromBlock = BigInt(fromArg);
const toBlock = arg('to') ? BigInt(arg('to')!) : await client.getBlockNumber();

const repository = new SqliteTokenRepository(process.env.DB_PATH || './data/proto.sqlite');
const poller = new EventPollerService(
  client,
  repository,
  new ViemChainIndexerAdapter(),
  new CalculatePricingUseCase(),
  new CoinGeckoPriceFeedAdapter(),
  network,
);

console.log(`[Backfill] ${network.name}: blocks ${fromBlock} -> ${toBlock}`);
let indexed = 0;
let windows = 0;
for (let from = fromBlock; from <= toBlock; from += STEP) {
  const to = from + STEP - 1n < toBlock ? from + STEP - 1n : toBlock;
  for (let attempt = 1; ; attempt++) {
    try {
      indexed += await poller.indexRange(from, to);
      break;
    } catch (e) {
      if (attempt >= 5) throw e;
      console.warn(`[Backfill] ${from}-${to} failed (${(e as Error).message}); retry ${attempt}/4`);
      await new Promise((r) => setTimeout(r, 1_000 * attempt));
    }
  }
  if (++windows % 100 === 0) {
    const pct = Number(((to - fromBlock) * 100n) / (toBlock - fromBlock + 1n));
    console.log(`[Backfill] ${pct}% | block ${to} | events indexed: ${indexed}`);
  }
}

console.log(`[Backfill] Done. Events indexed: ${indexed}`);
repository.close();
