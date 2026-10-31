/**
 * Fills in the quote price (priceQuote) of bonding-curve trades indexed before it was recorded,
 * so their candles follow the buys and sells like newer trades (see chartPriceUsd).
 *
 * Usage:
 *   bun run --env-file=.env scripts/backfill-trade-quote-prices.ts --chain <slug> [--dry-run]
 *
 * The curve's reserves after each trade are walked back from the reserves it holds now through
 * its Trade events (replayCurveReserves); the RPC keeps too little state history to read them at
 * old blocks. A curve is only written when the walk ends on a round launch token reserve (a
 * whole number of millions of tokens, within rounding: 1,000,000,000 from the current factory,
 * 1,073,000,000 from the first one), so every Trade event was accounted for; a missing or extra
 * trade would leave a remainder. Otherwise it is reported and left alone. Only trades without a priceQuote are updated, in
 * DB_PATH (default ./data/proto.sqlite). Pool trades (graduated tokens) are left as they are.
 */

import { Database } from 'bun:sqlite';
import { createPublicClient, type Address } from 'viem';
import { replayCurveReserves, type CurveTradeAmounts } from '../packages/math-sdk/src/index';
import {
  CHAINS,
  bondingCurveAbi,
  launchpadTokenAbi,
  resolveTokenNetwork,
  toViemChain,
} from '../packages/shared-types/src/index';
import { SqliteTokenRepository } from '../apps/api/src/index';
import { rpcTransport } from '../apps/api/src/core/rpc';
import {
  BACKFILL_CHUNK,
  TRADE_EVENT,
} from '../apps/api/src/modules/tokens/infrastructure/indexer/indexer-events';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const network = CHAINS.find((net) => net.slug === arg('chain'));
if (!network) {
  const slugs = CHAINS.map((net) => net.slug).join('|');
  console.error(`Usage: backfill-trade-quote-prices.ts --chain ${slugs} [--dry-run]`);
  process.exit(1);
}
const dryRun = process.argv.includes('--dry-run');
const client = createPublicClient({
  chain: toViemChain(network),
  transport: rpcTransport(network, 20_000),
});
const dbPath = process.env.DB_PATH || './data/proto.sqlite';
const repository = new SqliteTokenRepository(dbPath);
const db = new Database(dbPath);
const missing = db.prepare(
  'SELECT id FROM trades WHERE tokenAddress = ? COLLATE NOCASE AND priceQuote IS NULL',
);
const update = db.prepare('UPDATE trades SET priceQuote = ? WHERE id = ? AND priceQuote IS NULL');

const chunk =
  network.maxLogBlockRange && BigInt(network.maxLogBlockRange) < BACKFILL_CHUNK
    ? BigInt(network.maxLogBlockRange)
    : BACKFILL_CHUNK;
const pause = network.backfillRequestIntervalMs ?? 0;

/** Launch token reserves are factory constants in millions of tokens. */
const MILLION_TOKENS = 10n ** 24n;
/** Within a millionth of a token of a whole number of millions. */
const isRoundLaunch = (tokens: bigint) => {
  const rest = tokens % MILLION_TOKENS;
  return tokens > 0n && (rest < 10n ** 12n || MILLION_TOKENS - rest < 10n ** 12n);
};
const head = await client.getBlockNumber();

const tokens = (await repository.findAll(10_000, 0)).filter(
  (t) => t.version === 'v2' && t.curveAddress && resolveTokenNetwork(t).chainId === network.chainId,
);
console.log(`[QuotePrices] ${network.name}: ${tokens.length} curves${dryRun ? ' (dry run)' : ''}`);

let written = 0;
for (const token of tokens) {
  const ids = new Set(
    (missing.all(token.address) as Array<{ id: string }>).map((row) => row.id.toLowerCase()),
  );
  if (ids.size === 0) continue;
  const curve = token.curveAddress as Address;
  const label = `${token.symbol} ${token.address}`;
  try {
    const logs = [];
    for (let start = token.launchBlock; start <= head; start += chunk) {
      const end = start + chunk - 1n > head ? head : start + chunk - 1n;
      logs.push(
        ...(await client.getLogs({
          address: curve,
          event: TRADE_EVENT,
          fromBlock: start,
          toBlock: end,
        })),
      );
      if (pause) await Bun.sleep(pause);
    }
    logs.sort((a, b) =>
      a.blockNumber === b.blockNumber
        ? (a.logIndex ?? 0) - (b.logIndex ?? 0)
        : Number((a.blockNumber ?? 0n) - (b.blockNumber ?? 0n)),
    );
    const [taxConfig, onChainEth, onChainTokens] = await Promise.all([
      client.readContract({
        address: token.address,
        abi: launchpadTokenAbi,
        functionName: 'taxConfig',
      }),
      client.readContract({
        address: curve,
        abi: bondingCurveAbi,
        functionName: 'virtualEthReserve',
      }),
      client.readContract({
        address: curve,
        abi: bondingCurveAbi,
        functionName: 'virtualTokenReserve',
      }),
    ]);
    const trades: CurveTradeAmounts[] = logs.map((log) => {
      const a = log.args as {
        isBuy: boolean;
        ethAmount: bigint;
        tokenAmount: bigint;
        feeEth: bigint;
      };
      return {
        isBuy: a.isBuy,
        ethAmount: a.ethAmount,
        tokenAmount: a.tokenAmount,
        feeEth: a.feeEth,
      };
    });
    const sellTaxBps = BigInt((taxConfig as readonly [number, number, Address])[1]);
    const replay = replayCurveReserves(
      { virtualEthWei: onChainEth as bigint, virtualTokenWei: onChainTokens as bigint },
      trades,
      sellTaxBps,
    );
    if (!isRoundLaunch(replay.launch.virtualTokenWei)) {
      console.warn(
        `[QuotePrices] ${label}: walking back ${logs.length} trades ends at ${replay.launch.virtualTokenWei} token wei, not a launch reserve; skipped`,
      );
      continue;
    }
    let count = 0;
    logs.forEach((log, i) => {
      const id = `${log.transactionHash}-${log.logIndex}`.toLowerCase();
      if (!ids.has(id)) return;
      const r = replay.after[i]!;
      const priceQuote = Number(r.virtualEthWei) / Number(r.virtualTokenWei);
      if (!dryRun) update.run(priceQuote, `${log.transactionHash}-${log.logIndex}`);
      count++;
      if (dryRun) console.log(`  ${id} ${trades[i]!.isBuy ? 'buy ' : 'sell'} ${priceQuote}`);
    });
    written += count;
    console.log(
      `[QuotePrices] ${label}: ${count} of ${ids.size} trades (launch ${replay.launch.virtualEthWei} / ${replay.launch.virtualTokenWei} wei)`,
    );
  } catch (e) {
    console.warn(`[QuotePrices] ${label}: ${(e as Error).message}`);
  }
}
console.log(`[QuotePrices] done: ${written} trades ${dryRun ? 'would be ' : ''}updated`);
process.exit(0);
