import { formatUnits, getAddress } from 'viem';
import type { LaunchedTokenEntity, NetworkConfig, TradeEventEntity } from '@goton/shared-types';
import { isCurvePair, parsePairId, toUnixSeconds } from '../domain/dex-pair';

/**
 * Response builders for the DEX Screener Adapter (spec v1.1, Dec 2023):
 * https://dexscreener.notion.site/DEX-Screener-Adapter-Specs-cc1223cdf6e74a7799599106b65dcd0e
 *
 * A token trades in two pairs over its life, and each is its own DEX Screener pair:
 * - its bonding curve, identified by the curve contract's address (0x + 40 hex);
 * - after graduation (or from launch on Arc v4), its Uniswap v4 pool, identified by the v4
 *   poolId (0x + 64 hex). v4 pools have no contract of their own; the PoolManager holds them all.
 * asset0 is always the token and asset1 the quote (WETH on Robinhood Chain, USDC on Arc), so
 * priceNative is the token's price in the quote and the order never changes for a pair.
 */

const DEX_KEY = 'goton';

export function latestBlockResponse(blockNumber: bigint, blockTimestamp: number) {
  return {
    block: { blockNumber: Number(blockNumber), blockTimestamp: toUnixSeconds(blockTimestamp) },
  };
}

export function tokenAssetResponse(token: LaunchedTokenEntity) {
  // Decimalized: DEX Screener derives FDV and market cap from these.
  const supply = formatUnits(BigInt(token.totalSupply || '0'), token.decimals);
  return {
    asset: {
      id: getAddress(token.address),
      name: token.name,
      symbol: token.symbol,
      totalSupply: supply,
      // Fixed supply with no mint and no vesting: everything minted circulates.
      circulatingSupply: supply,
    },
  };
}

/** The quote asset of every goton pair on `network`: WETH on Robinhood Chain, USDC on Arc. */
export function quoteAssetResponse(network: NetworkConfig) {
  const native = network.nativeCurrency;
  const wrapped = native.symbol === 'ETH';
  return {
    asset: {
      id: getAddress(network.contracts.weth),
      name: wrapped ? 'Wrapped Ether' : native.name,
      symbol: wrapped ? 'WETH' : native.symbol,
    },
  };
}

export function pairResponse(token: LaunchedTokenEntity, pairId: string, network: NetworkConfig) {
  const curve = isCurvePair(token, pairId);
  // A graduated token's v4 pool was created at graduation, which the index does not record.
  const createdWithToken = curve || !token.isGraduated;
  const launchBlock = Number(token.launchBlock ?? 0);
  return {
    pair: {
      id: pairId,
      dexKey: DEX_KEY,
      asset0Id: getAddress(token.address),
      asset1Id: getAddress(network.contracts.weth),
      ...(createdWithToken && launchBlock > 0 ? { createdAtBlockNumber: launchBlock } : {}),
      ...(createdWithToken && token.createdAt > 0
        ? { createdAtBlockTimestamp: toUnixSeconds(token.createdAt) }
        : {}),
      creator: getAddress(token.deployer),
      feeBps: Math.round(token.poolFee / 100),
      metadata: curve
        ? { kind: 'bonding-curve' }
        : {
            kind: 'uniswap-v4',
            poolManager: network.contracts.poolManagerV4 ?? '',
            tickSpacing: '200',
          },
    },
  };
}

/** The log index from a trade id (`<txHash>-<logIndex>`), or null when the id has none. */
function logIndexOf(trade: TradeEventEntity): number | null {
  const tail = trade.id.slice(trade.id.lastIndexOf('-') + 1);
  return /^\d+$/.test(tail) ? Number(tail) : null;
}

/**
 * A trade as a swap event, or null when it cannot be a valid one (DEX Screener halts indexing
 * on a zero price). The log index is unique within a block and grows with transaction order,
 * so it serves as both txnIndex and eventIndex: ordering is preserved and the pair is unique.
 */
export function swapEvent(trade: TradeEventEntity) {
  const tokenAmount = trade.tokenAmount;
  const quoteAmount = trade.wethAmount;
  const tokenValue = Number(tokenAmount);
  const quoteValue = Number(quoteAmount);
  const logIndex = logIndexOf(trade);
  const pairId = parsePairId(trade.poolAddress);
  if (!(tokenValue > 0 && quoteValue > 0) || logIndex === null || !pairId) return null;
  return {
    block: {
      blockNumber: Number(trade.blockNumber),
      blockTimestamp: toUnixSeconds(trade.timestamp),
    },
    eventType: 'swap' as const,
    txnId: trade.transactionHash,
    txnIndex: logIndex,
    eventIndex: logIndex,
    maker: getAddress(trade.trader),
    pairId,
    ...(trade.isBuy
      ? { asset1In: quoteAmount, asset0Out: tokenAmount }
      : { asset0In: tokenAmount, asset1Out: quoteAmount }),
    priceNative: quoteValue / tokenValue,
  };
}

/** Swap events for a block range, oldest first, skipping trades that cannot be valid events. */
export function eventsResponse(trades: TradeEventEntity[]) {
  const events = trades
    .map(swapEvent)
    .filter((event): event is NonNullable<typeof event> => event !== null)
    .sort((a, b) => a.block.blockNumber - b.block.blockNumber || a.eventIndex - b.eventIndex);
  return { events };
}
