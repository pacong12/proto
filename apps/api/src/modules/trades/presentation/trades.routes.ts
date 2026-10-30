import { isAddress, ok, err } from '@goton/shared-types';
import type { Router } from '../../../core/http/router';
import type { AppContainer } from '../../../app/container';

/** HTTP routes of the trades module, registered in the order they are matched. */
export function registerTradesRoutes(router: Router, deps: AppContainer): void {
  const { repository, tradeController } = deps;
  // GET /api/trades (global recent protocol trades or trades by trader)
  router.on('GET', '/api/trades', async ({ url, replyEnvelope }) => {
    const rawLimit = parseInt(url.searchParams.get('limit') ?? '30', 10);
    const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 30 : rawLimit));
    const trader = url.searchParams.get('trader') || undefined;
    const res = await tradeController.getRecentTrades(trader, limit);
    return replyEnvelope(res, { 'Cache-Control': 'public, max-age=2' });
  });

  router.on('GET', /^\/api\/trades\/(0x[a-fA-F0-9]{64})$/, async ({ replyJson }, singleTxMatch) => {
    const txHash = singleTxMatch[1];
    const trade = repository.findTradeByHash ? await repository.findTradeByHash(txHash) : null;
    if (!trade) {
      return replyJson(err('NOT_FOUND', 'Transaction not found in protocol activity'), 404);
    }
    return replyJson(ok(trade));
  });

  router.on(
    'GET',
    /^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/trades$/,
    async ({ url, replyEnvelope }, tradesMatch) => {
      const address = tradesMatch[1];
      // Clamp limit/offset to prevent unbounded DB allocations.
      const rawLimit = parseInt(url.searchParams.get('limit') ?? '50', 10);
      const rawOffset = parseInt(url.searchParams.get('offset') ?? '0', 10);
      const limit = Math.min(200, Math.max(1, isNaN(rawLimit) ? 50 : rawLimit));
      const offset = Math.max(0, isNaN(rawOffset) ? 0 : rawOffset);
      const res = await tradeController.getTrades(address, limit, offset);
      return replyEnvelope(res, {
        'Cache-Control': 'public, max-age=1, stale-while-revalidate=2',
      });
    },
  );

  router.on(
    'GET',
    /^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/ohlcv$/,
    async ({ url, replyEnvelope }, ohlcvMatch) => {
      const address = ohlcvMatch[1];
      const resolution = parseInt(url.searchParams.get('resolution') ?? '1', 10);
      const fillGaps = url.searchParams.get('fillGaps') !== 'false';
      const res = await tradeController.getCandlesticks(address, resolution, fillGaps);
      return replyEnvelope(res, {
        'Cache-Control': 'public, max-age=1, stale-while-revalidate=2',
      });
    },
  );

  router.on(
    'GET',
    /^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/top-traders$/,
    async ({ url, replyEnvelope }, topTradersMatch) => {
      const address = topTradersMatch[1];
      const rawLimit = parseInt(url.searchParams.get('limit') ?? '20', 10);
      const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 20 : rawLimit));
      const res = await tradeController.getTopTraders(address, limit);
      return replyEnvelope(res, {
        'Cache-Control': 'public, max-age=1, stale-while-revalidate=2',
      });
    },
  );

  // GET /api/orders?owner=0x..&token=0x..&status=open|filled|cancelled — limit orders (GotonLimitOrders)
  router.on('GET', '/api/orders', async ({ url, replyError, replyEnvelope }) => {
    const owner = url.searchParams.get('owner') ?? undefined;
    const token = url.searchParams.get('token') ?? undefined;
    const status = url.searchParams.get('status') ?? undefined;
    const isAddr = (v?: string) => v === undefined || isAddress(v);
    if (!isAddr(owner) || !isAddr(token))
      return replyError('INVALID_PARAM', 'owner and token must be addresses', 400);
    if (!owner && !token) return replyError('INVALID_PARAM', 'owner or token is required', 400);
    if (status && !['open', 'filled', 'cancelled'].includes(status)) {
      return replyError('INVALID_PARAM', 'status must be open, filled or cancelled', 400);
    }
    const orders =
      (await repository.listLimitOrders?.({
        owner,
        token,
        status: status as 'open' | 'filled' | 'cancelled' | undefined,
        limit: 100,
      })) ?? [];
    return replyEnvelope(ok(orders));
  });
}
