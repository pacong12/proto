import { resolveNetworkByParam } from '@goton/shared-types';
import { safeStringify } from '../../../core';
import { replyCached } from '../../../core/http/cached-reply';
import type { Router } from '../../../core/http/router';
import type { AppContainer } from '../../../app/container';
import * as dexScreener from './dex-screener.presenter';
import * as gecko from './gecko-terminal.presenter';

/** GeckoTerminal OHLCV timeframes as candle widths in seconds (VALID_RESOLUTIONS). */
const GECKO_TIMEFRAME_SECONDS = { minute: 60, hour: 3600, day: 86400 } as const;

/** HTTP routes of the dex module, registered in the order they are matched. */
export function registerDexRoutes(router: Router, deps: AppContainer): void {
  const { cache, priceFeed, chainRegistry, dexScreenerService, geckoTerminalService } = deps;
  // GET /api/price — returns live ETH price from CoinGecko
  router.on('GET', '/api/price', async ({ headers, replyError }) => {
    try {
      const ethPriceUsd = await priceFeed.getEthPriceUsd();
      return new Response(
        safeStringify({
          success: true,
          data: { ethPriceUsd, source: 'coingecko' },
          timestamp: Date.now(),
        }),
        { headers },
      );
    } catch {
      return replyError('PRICE_FEED_ERROR', 'Failed to fetch ETH price', 502);
    }
  });

  router.on(
    'GET',
    /^\/dex\/(?:([a-z0-9-]+)\/)?(latest-block|asset|pair|events)$/,
    ({ url, replyJson, replyError, replyCatching }, dexMatch) => {
      const chainKey =
        dexMatch[1] ?? url.searchParams.get('chain') ?? url.searchParams.get('chainId');
      const resolved = resolveNetworkByParam(chainKey);
      if (
        dexMatch[1] &&
        ![String(resolved.chainId), resolved.slug, ...(resolved.aliases ?? [])].includes(
          dexMatch[1],
        )
      ) {
        return replyError('NOT_FOUND', `Unknown chain ${dexMatch[1]}`, 404);
      }
      const chain = chainRegistry.getChainById(resolved.chainId);
      const network = chain.network;
      const id = url.searchParams.get('id');

      return replyCatching(async () => {
        switch (dexMatch[2]) {
          case 'latest-block':
            return replyCached(
              cache,
              replyJson,
              `dex:v1.1:latest-block:${network.chainId}`,
              2,
              async () => {
                const { blockNumber, blockTimestamp } = await dexScreenerService.latestBlock(chain);
                return dexScreener.latestBlockResponse(blockNumber, blockTimestamp);
              },
            );
          case 'asset': {
            const asset = await dexScreenerService.asset(network, id ?? '');
            return replyJson(
              asset === 'quote'
                ? dexScreener.quoteAssetResponse(network)
                : dexScreener.tokenAssetResponse(asset),
            );
          }
          case 'pair': {
            const { token, pairId } = await dexScreenerService.pair(network, id ?? '');
            return replyJson(dexScreener.pairResponse(token, pairId, network));
          }
          default: {
            // events: both bounds required and inclusive.
            const trades = await dexScreenerService.events(
              network,
              url.searchParams.get('fromBlock') ?? '',
              url.searchParams.get('toBlock') ?? '',
              id,
            );
            return replyJson(dexScreener.eventsResponse(trades));
          }
        }
      });
    },
  );

  router.on(
    'GET',
    /^\/api\/v1\/networks\/([^/]+)\/pools\/(0x[a-fA-F0-9]{40})$/,
    ({ replyJson, replyCatching }, match) => {
      const chain = chainRegistry.getChainByParam(match[1]);
      const poolAddress = match[2].toLowerCase() as `0x${string}`;
      return replyCatching(() =>
        replyCached(
          cache,
          replyJson,
          `gecko:pool:${chain.network.chainId}:${poolAddress}`,
          15,
          async () =>
            gecko.poolResponse(chain.network, await geckoTerminalService.pool(chain, poolAddress)),
        ),
      );
    },
  );

  router.on(
    'GET',
    /^\/api\/v1\/networks\/([^/]+)\/tokens\/(0x[a-fA-F0-9]{40})$/,
    ({ replyJson, replyCatching }, match) => {
      const chain = chainRegistry.getChainByParam(match[1]);
      const tokenAddress = match[2].toLowerCase() as `0x${string}`;
      return replyCatching(() =>
        replyCached(
          cache,
          replyJson,
          `gecko:token:${chain.network.chainId}:${tokenAddress}`,
          30,
          async () => {
            const { token, marketData, quotePriceUsd } = await geckoTerminalService.token(
              chain,
              tokenAddress,
            );
            return gecko.tokenResponse(chain.network, token, marketData, quotePriceUsd);
          },
        ),
      );
    },
  );

  router.on(
    'GET',
    /^\/api\/v1\/networks\/([^/]+)\/pools\/(0x[a-fA-F0-9]{40})\/ohlcv\/(minute|hour|day)$/,
    ({ url, replyJson, replyCatching }, match) => {
      const chain = chainRegistry.getChainByParam(match[1]);
      const poolAddress = match[2].toLowerCase() as `0x${string}`;
      const timeframe = match[3] as keyof typeof GECKO_TIMEFRAME_SECONDS;
      const limit = Math.min(1000, parseInt(url.searchParams.get('limit') ?? '100', 10));
      return replyCatching(async () => {
        const { token, candles } = await geckoTerminalService.ohlcv(
          poolAddress,
          GECKO_TIMEFRAME_SECONDS[timeframe],
          limit,
        );
        return replyJson(gecko.ohlcvResponse(chain.network, token, timeframe, candles));
      });
    },
  );

  router.on(
    'GET',
    /^\/api\/v1\/networks\/([^/]+)\/pools\/(0x[a-fA-F0-9]{40})\/trades$/,
    ({ replyJson, replyCatching }, match) => {
      const chain = chainRegistry.getChainByParam(match[1]);
      const poolAddress = match[2].toLowerCase() as `0x${string}`;
      return replyCatching(async () => {
        const { token, trades, quotePriceUsd } = await geckoTerminalService.trades(
          chain,
          poolAddress,
        );
        return replyJson(gecko.tradesResponse(chain.network, token, trades, quotePriceUsd));
      });
    },
  );
}
