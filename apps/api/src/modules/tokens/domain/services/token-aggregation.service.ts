import { parseUnits } from 'viem';
import { LaunchedTokenEntity, TradeEventEntity } from '@goton/shared-types';

export interface HolderItem {
  address: string;
  balance: string;
  percent: number;
}

/** OHLCV aggregation lives in @goton/math-sdk, shared with the app. */
export { aggregateCandlesticks } from '@goton/math-sdk';

/**
 * Where a token's candles start: its launch time, or its first trade when that is earlier (tokens
 * indexed before createdAt was the launch block's time have a later one). Undefined with neither.
 */
export function chartStartTime(
  createdAt: number | undefined,
  firstTradeAt: number | undefined,
): number | undefined {
  const start = Math.min(createdAt ?? Infinity, firstTradeAt ?? Infinity);
  return Number.isFinite(start) ? start : undefined;
}

function toBaseUnits(amount: string, decimals: number): bigint {
  try {
    return parseUnits(amount.trim(), decimals);
  } catch {
    return 0n;
  }
}

/**
 * Holders from indexed on-chain balances, largest first. The v4 PoolManager holds a pool's tokens
 * for every pool on the chain, so its row is shown under the token's pool address, which the app
 * labels as the pool.
 */
export function holdersFromBalances(
  token: LaunchedTokenEntity | null,
  balances: Array<{ holder: string; balance: string }>,
  limit = 50,
  poolHolders: string[] = [],
): HolderItem[] {
  let totalSupply = 1_000_000_000n * 10n ** 18n;
  try {
    if (token?.totalSupply) totalSupply = BigInt(token.totalSupply);
  } catch {
    // keep the default supply
  }
  const pool = new Set(poolHolders.map((a) => a.toLowerCase()));
  return balances
    .map((b) => ({ holder: b.holder, amount: BigInt(b.balance) }))
    .filter((b) => b.amount > 0n)
    .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0))
    .slice(0, limit)
    .map((b) => ({
      address:
        pool.has(b.holder.toLowerCase()) && token?.poolAddress ? token.poolAddress : b.holder,
      balance: b.amount.toString(),
      percent: Number((b.amount * 10000n) / totalSupply) / 100,
    }));
}

export function computeHoldersDistribution(
  token: LaunchedTokenEntity | null,
  trades: TradeEventEntity[],
  limit = 50,
): HolderItem[] {
  let totalSupply = 1_000_000_000n * 10n ** 18n;
  if (token?.totalSupply) {
    try {
      totalSupply = BigInt(token.totalSupply);
    } catch {
      totalSupply = 1_000_000_000n * 10n ** 18n;
    }
  }

  const poolAddress = token?.poolAddress || '0x000000000000000000000000000000000000dEaD';
  const deployerAddress = token?.deployer || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

  const traderBalances = new Map<string, bigint>();
  for (const trade of trades) {
    const trader = trade.trader.toLowerCase();
    if (trader === poolAddress.toLowerCase()) continue;

    // API-01: trades store human-readable token amounts (e.g. "204857030.2081"); convert to the
    // token's base units so they are comparable with totalSupply.
    const amount = toBaseUnits(trade.tokenAmount, token?.decimals ?? 18);

    const cur = traderBalances.get(trader) ?? 0n;
    if (trade.isBuy) {
      traderBalances.set(trader, cur + amount);
    } else {
      traderBalances.set(trader, cur > amount ? cur - amount : 0n);
    }
  }

  // The creator's launch buy is indexed as a regular trade, so it is already in traderBalances.
  // (initialBuyAmount is the quote amount paid, not a token balance.)
  const activeTraders = Array.from(traderBalances.entries())
    .filter(([addr, bal]) => bal > 0n && addr !== deployerAddress.toLowerCase())
    .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0));

  const totalTraderTokens = activeTraders.reduce((sum, [, bal]) => sum + bal, 0n);
  const holders: HolderItem[] = [];

  const totalDeployerBalance = traderBalances.get(deployerAddress.toLowerCase()) ?? 0n;
  const nonPoolTotal = totalDeployerBalance + totalTraderTokens;
  const poolBalance = totalSupply > nonPoolTotal ? totalSupply - nonPoolTotal : 0n;

  holders.push({
    address: poolAddress,
    balance: poolBalance.toString(),
    percent: Number((poolBalance * 10000n) / totalSupply) / 100,
  });

  if (totalDeployerBalance > 0n) {
    holders.push({
      address: deployerAddress,
      balance: totalDeployerBalance.toString(),
      percent: Number((totalDeployerBalance * 10000n) / totalSupply) / 100,
    });
  }

  for (const [addr, bal] of activeTraders) {
    holders.push({
      address: addr,
      balance: bal.toString(),
      percent: Number((bal * 10000n) / totalSupply) / 100,
    });
  }

  return holders.slice(0, limit);
}
