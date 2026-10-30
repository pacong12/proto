import { findAllTokens } from '../../modules/tokens/application/all-tokens';
import * as dexAdapter from '../../modules/dex/dex-screener.adapter';
import {
  type LaunchedTokenEntity,
  type TradeEventEntity,
  resolveNetworkByParam,
} from '@goton/shared-types';
import { safeStringify } from '../../core';
import type { Router } from '../../core/http/router';
import type { AppContainer } from '../../app/container';

/** GeckoTerminal OHLCV timeframes as candle widths in seconds (VALID_RESOLUTIONS). */
const GECKO_TIMEFRAME_SECONDS = { minute: 60, hour: 3600, day: 86400 } as const;

/** HTTP routes of the dex module, registered in the order they are matched. */
export function registerDexRoutes(router: Router, deps: AppContainer): void {
  const { cache, repository, priceFeed, tokenController, tradeController, chainRegistry } = deps;
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
    async ({ url, replyJson, replyError }, dexMatch) => {
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
      const onThisChain = (token: LaunchedTokenEntity) =>
        chainRegistry.resolveForToken(token).network.chainId === network.chainId;
      const endpoint = dexMatch[2];

      if (endpoint === 'latest-block') {
        // The indexer's persisted cursor, not the chain head: /events must already hold every
        // event up to the block reported here.
        const cacheKey = `dex:v1.1:latest-block:${network.chainId}`;
        const cached = await cache.get<unknown>(cacheKey);
        if (cached) return replyJson(cached, 200, { 'x-cache': 'HIT' });
        const blockNumber = (await repository.getLastIndexedBlock?.(network.name)) ?? 0n;
        if (blockNumber <= 0n) {
          return replyError('NOT_READY', 'The indexer has not stored a block yet', 503);
        }
        let timestamp: number;
        try {
          timestamp = Number((await chain.client.getBlock({ blockNumber })).timestamp);
        } catch {
          return replyError('UPSTREAM_ERROR', 'Could not read the block timestamp', 502);
        }
        const payload = dexAdapter.latestBlockResponse(blockNumber, timestamp);
        await cache.set(cacheKey, payload, 2);
        return replyJson(payload, 200, { 'x-cache': 'MISS' });
      }

      if (endpoint === 'asset') {
        const assetId = dexAdapter.parseAssetId(url.searchParams.get('id') ?? '');
        if (!assetId) return replyError('BAD_REQUEST', 'id must be a 0x contract address', 400);
        if (assetId.toLowerCase() === network.contracts.weth.toLowerCase()) {
          return replyJson(dexAdapter.quoteAssetResponse(network));
        }
        const token = await repository.findByAddress(assetId);
        if (!token || !onThisChain(token)) return replyError('NOT_FOUND', 'Asset not found', 404);
        return replyJson(dexAdapter.tokenAssetResponse(token));
      }

      if (endpoint === 'pair') {
        const pairId = dexAdapter.parsePairId(url.searchParams.get('id') ?? '');
        if (!pairId) {
          return replyError(
            'BAD_REQUEST',
            'id must be a bonding curve address (0x + 40 hex) or a v4 poolId (0x + 64 hex)',
            400,
          );
        }
        // The current pair (curve, or v4 pool once graduated), else a graduated token's old curve.
        const token =
          (await repository.findByPoolAddress?.(pairId as `0x${string}`)) ??
          (dexAdapter.parseAssetId(pairId)
            ? ((await findAllTokens(repository)).find((t) => dexAdapter.isCurvePair(t, pairId)) ??
              null)
            : null);
        if (!token || !onThisChain(token)) return replyError('NOT_FOUND', 'Pair not found', 404);
        return replyJson(dexAdapter.pairResponse(token, pairId, network));
      }

      // endpoint === 'events': both bounds required and inclusive.
      const rawFrom = url.searchParams.get('fromBlock') ?? '';
      const rawTo = url.searchParams.get('toBlock') ?? '';
      if (!/^\d+$/.test(rawFrom) || !/^\d+$/.test(rawTo) || BigInt(rawFrom) > BigInt(rawTo)) {
        return replyError(
          'INVALID_PARAM',
          'fromBlock and toBlock are required integers, fromBlock <= toBlock',
          400,
        );
      }
      const pairFilter = url.searchParams.get('id');
      const pairId = pairFilter ? dexAdapter.parsePairId(pairFilter) : null;
      if (pairFilter && !pairId) return replyError('BAD_REQUEST', 'Invalid pair id', 400);
      const limit = 5000;
      const trades =
        (await repository.getTradesInBlockRange?.(BigInt(rawFrom), BigInt(rawTo), limit + 1)) ?? [];
      // Each block is indexed once: a truncated range would lose events, so ask for a smaller one.
      if (trades.length > limit) {
        return replyError('RANGE_TOO_LARGE', `More than ${limit} events; use a smaller range`, 413);
      }
      const tokens = new Map<string, LaunchedTokenEntity | null>();
      const kept: TradeEventEntity[] = [];
      for (const trade of trades) {
        const key = trade.tokenAddress.toLowerCase();
        if (!tokens.has(key)) tokens.set(key, await repository.findByAddress(trade.tokenAddress));
        const token = tokens.get(key);
        if (!token || !onThisChain(token)) continue;
        if (pairId && dexAdapter.parsePairId(trade.poolAddress) !== pairId) continue;
        kept.push(trade);
      }
      return replyJson(dexAdapter.eventsResponse(kept));
    },
  );

  router.on(
    'GET',
    /^\/api\/v1\/networks\/([^/]+)\/pools\/(0x[a-fA-F0-9]{40})$/,
    async ({ replyJson, replyError }, geckoPoolMatch) => {
      const netParam = geckoPoolMatch[1];
      const chain = chainRegistry.getChainByParam(netParam);
      const network = chain.network;
      const poolAddr = geckoPoolMatch[2].toLowerCase() as `0x${string}`;
      const cacheKey = `gecko:pool:${network.chainId}:${poolAddr}`;
      const cached = await cache.get<unknown>(cacheKey);
      if (cached) return replyJson(cached, 200, { 'x-cache': 'HIT' });

      // findByPoolAddress avoids loading all tokens to scan for a single pool address.
      const token = repository.findByPoolAddress
        ? await repository.findByPoolAddress(poolAddr)
        : ((await repository.findAll()).find((t) => t.poolAddress.toLowerCase() === poolAddr) ??
          null);
      if (!token) return replyError('NOT_FOUND', 'Pool not found', 404);

      const quotePriceUsd = await chain.getQuotePriceUsd();
      const quoteSymbol = network.nativeCurrency.symbol;
      const trades = await repository.getTrades(token.address, 500, 0);
      const mkt = await repository.getMarketData(token.address as `0x${string}`);
      let vol24h = 0;
      const cutoff = Date.now() - 86_400_000;
      if (repository.getTradeFlow) {
        // Summed in SQL: the newest 500 trades undercount an active pool's 24h volume.
        const flow = await repository.getTradeFlow(token.address as `0x${string}`, cutoff);
        vol24h = flow.buyQuote + flow.sellQuote;
      } else {
        for (const tr of trades) {
          if ((tr.timestamp ?? 0) >= cutoff) vol24h += parseFloat(tr.wethAmount);
        }
      }

      const priceUsdValue = trades[0]?.priceUsd ?? mkt?.priceUsd ?? 0;
      const tokenAmt = parseFloat(trades[0]?.tokenAmount ?? '0');
      const wethAmt = parseFloat(trades[0]?.wethAmount ?? '0');
      const priceNative = tokenAmt > 0 ? (wethAmt / tokenAmt).toFixed(18) : '0';

      const payload = {
        data: {
          id: `${network.chainId}_${token.poolAddress}`,
          type: 'pool',
          attributes: {
            base_token_price_usd: priceUsdValue.toFixed(12),
            quote_token_price_usd: quotePriceUsd.toFixed(2),
            base_token_price_native_currency: priceNative,
            address: token.poolAddress,
            name: `${token.symbol} / ${quoteSymbol}`,
            pool_created_at: new Date(token.createdAt).toISOString(),
            token_price_usd: priceUsdValue.toFixed(12),
            fdv_usd: mkt?.fdvUsd ? mkt.fdvUsd.toFixed(2) : null,
            market_cap_usd: mkt?.marketCapUsd ? mkt.marketCapUsd.toFixed(2) : null,
            price_change_h1: null,
            price_change_h24: null,
            transactions_h24_buys: trades.filter((t) => t.isBuy && (t.timestamp ?? 0) >= cutoff)
              .length,
            transactions_h24_sells: trades.filter((t) => !t.isBuy && (t.timestamp ?? 0) >= cutoff)
              .length,
            volume_usd: { h24: (vol24h * quotePriceUsd).toFixed(2) },
            reserve_in_usd: mkt?.pairedPrincipalWeth
              ? (parseFloat(mkt.pairedPrincipalWeth) * quotePriceUsd).toFixed(2)
              : null,
          },
          relationships: {
            base_token: {
              data: { id: `${network.chainId}_${token.address}`, type: 'token' },
            },
            quote_token: {
              data: {
                id: `${network.chainId}_${network.contracts.weth}`,
                type: 'token',
              },
            },
            dex: { data: { id: 'proto', type: 'dex' } },
          },
        },
      };
      await cache.set(cacheKey, payload, 15);
      return replyJson(payload, 200, { 'x-cache': 'MISS' });
    },
  );

  router.on(
    'GET',
    /^\/api\/v1\/networks\/([^/]+)\/tokens\/(0x[a-fA-F0-9]{40})$/,
    async ({ replyJson, replyError }, geckoTokenMatch) => {
      const netParam = geckoTokenMatch[1];
      const network = resolveNetworkByParam(netParam);
      const tokenAddr = geckoTokenMatch[2].toLowerCase() as `0x${string}`;
      const cacheKey = `gecko:token:${network.chainId}:${tokenAddr}`;
      const cached = await cache.get<unknown>(cacheKey);
      if (cached) return replyJson(cached, 200, { 'x-cache': 'HIT' });

      const res = await tokenController.getToken(tokenAddr);
      if (!res.success || !res.data) return replyError('NOT_FOUND', 'Token not found', 404);
      const td = res.data as {
        token: import('@goton/shared-types').LaunchedTokenEntity;
        marketData: import('@goton/shared-types').TokenMarketData;
      };
      const t = td.token;
      const m = td.marketData;
      const chain = chainRegistry.getChainById(network.chainId);
      const quotePriceUsd = await chain.getQuotePriceUsd();

      const payload = {
        data: {
          id: `${network.chainId}_${t.address}`,
          type: 'token',
          attributes: {
            address: t.address,
            name: t.name,
            symbol: t.symbol,
            decimals: t.decimals,
            image_url: t.logo || null,
            coingecko_coin_id: null,
            total_supply: t.totalSupply,
            price_usd: m?.priceUsd ? m.priceUsd.toString() : null,
            fdv_usd: m?.fdvUsd ? m.fdvUsd.toFixed(2) : null,
            total_reserve_in_usd: m?.pairedPrincipalWeth
              ? (parseFloat(m.pairedPrincipalWeth) * quotePriceUsd).toFixed(2)
              : null,
            volume_usd: { h24: m?.volume24hUsd ? m.volume24hUsd.toFixed(2) : null },
            market_cap_usd: m?.marketCapUsd ? m.marketCapUsd.toFixed(2) : null,
          },
        },
      };
      await cache.set(cacheKey, payload, 30);
      return replyJson(payload, 200, { 'x-cache': 'MISS' });
    },
  );

  router.on(
    'GET',
    /^\/api\/v1\/networks\/([^/]+)\/pools\/(0x[a-fA-F0-9]{40})\/ohlcv\/(minute|hour|day)$/,
    async ({ url, replyJson, replyError }, geckoOhlcvMatch) => {
      const netParam = geckoOhlcvMatch[1];
      const chain = chainRegistry.getChainByParam(netParam);
      const network = chain.network;
      const poolAddr = geckoOhlcvMatch[2].toLowerCase() as `0x${string}`;
      const timeframe = geckoOhlcvMatch[3];
      const limit = Math.min(1000, parseInt(url.searchParams.get('limit') ?? '100', 10));

      const token = repository.findByPoolAddress
        ? await repository.findByPoolAddress(poolAddr)
        : ((await repository.findAll()).find((t) => t.poolAddress.toLowerCase() === poolAddr) ??
          null);
      if (!token) return replyError('NOT_FOUND', 'Pool not found', 404);

      const resolution = GECKO_TIMEFRAME_SECONDS[timeframe as keyof typeof GECKO_TIMEFRAME_SECONDS];
      const ohlcvRes = await tradeController.getCandlesticks(token.address, resolution);
      const candles = (ohlcvRes.data ?? []) as import('@goton/shared-types').CandlestickEntity[];
      const sliced = candles.slice(-limit);

      const payload = {
        data: {
          id: `${network.chainId}_${token.poolAddress}_${timeframe}`,
          type: 'ohlcv',
          attributes: {
            ohlcv_list: sliced.map((c) => [c.timestamp, c.open, c.high, c.low, c.close, c.volume]),
          },
        },
        meta: { base: token.symbol, quote: network.nativeCurrency.symbol },
      };
      return replyJson(payload);
    },
  );

  router.on(
    'GET',
    /^\/api\/v1\/networks\/([^/]+)\/pools\/(0x[a-fA-F0-9]{40})\/trades$/,
    async ({ replyJson, replyError }, geckoTradesMatch) => {
      const netParam = geckoTradesMatch[1];
      const chain = chainRegistry.getChainByParam(netParam);
      const network = chain.network;
      const poolAddr = geckoTradesMatch[2].toLowerCase() as `0x${string}`;
      const token = repository.findByPoolAddress
        ? await repository.findByPoolAddress(poolAddr)
        : ((await repository.findAll()).find((t) => t.poolAddress.toLowerCase() === poolAddr) ??
          null);
      if (!token) return replyError('NOT_FOUND', 'Pool not found', 404);

      const trades = await repository.getTrades(token.address, 100, 0);
      const quotePriceUsd = await chain.getQuotePriceUsd();

      const payload = {
        data: trades.map((tr) => ({
          id: tr.transactionHash,
          type: 'trade',
          attributes: {
            block_number: Number(tr.blockNumber),
            tx_hash: tr.transactionHash,
            tx_from_address: tr.trader,
            from_token_amount: tr.isBuy ? tr.wethAmount : tr.tokenAmount,
            to_token_amount: tr.isBuy ? tr.tokenAmount : tr.wethAmount,
            price_from_in_currency_usd: tr.isBuy
              ? quotePriceUsd.toFixed(2)
              : tr.priceUsd.toFixed(8),
            price_to_in_currency_usd: tr.isBuy ? tr.priceUsd.toFixed(8) : quotePriceUsd.toFixed(2),
            price_from_in_usd: tr.isBuy ? quotePriceUsd.toFixed(2) : tr.priceUsd.toFixed(8),
            price_to_in_usd: tr.isBuy ? tr.priceUsd.toFixed(8) : quotePriceUsd.toFixed(2),
            kind: tr.isBuy ? 'buy' : 'sell',
            volume_in_usd: (parseFloat(tr.wethAmount) * quotePriceUsd).toFixed(2),
            block_timestamp: new Date(tr.timestamp ?? 0).toISOString(),
          },
          relationships: {
            from_token: {
              data: {
                id: tr.isBuy
                  ? `${network.chainId}_${network.contracts.weth}`
                  : `${network.chainId}_${token.address}`,
                type: 'token',
              },
            },
            to_token: {
              data: {
                id: tr.isBuy
                  ? `${network.chainId}_${token.address}`
                  : `${network.chainId}_${network.contracts.weth}`,
                type: 'token',
              },
            },
          },
        })),
      };
      return replyJson(payload);
    },
  );
}
