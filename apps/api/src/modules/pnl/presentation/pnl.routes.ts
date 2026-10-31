import { ok } from '@goton/shared-types';
import { cacheHeader, readThrough, replyCachedEnvelope } from '../../../core/http/cached-reply';
import type { Router } from '../../../core/http/router';
import type { AppContainer } from '../../../app/container';

const POSITION = '(0x[a-fA-F0-9]{40})\\/(0x[a-fA-F0-9]{40})';

/** HTTP routes of the pnl module: a wallet's PnL on a token, as JSON and as a shareable card. */
export function registerPnlRoutes(router: Router, deps: AppContainer): void {
  const { cache, pnlService, siteUrls } = deps;

  // GET /api/pnl/:wallet — every position of the wallet, held or sold.
  router.on(
    'GET',
    /^\/api\/pnl\/(0x[a-fA-F0-9]{40})$/,
    ({ replyEnvelope, replyCatching }, [, wallet]) =>
      replyCatching(() =>
        replyCachedEnvelope(
          cache,
          replyEnvelope,
          `pnl:wallet:${wallet.toLowerCase()}`,
          30,
          async () => ok(await pnlService.positions(wallet)),
        ),
      ),
  );

  // GET /api/pnl/:wallet/:token
  router.on(
    'GET',
    new RegExp(`^\\/api\\/pnl\\/${POSITION}$`),
    ({ replyEnvelope, replyCatching }, [, wallet, token]) =>
      replyCatching(() =>
        replyCachedEnvelope(
          cache,
          replyEnvelope,
          `pnl:${wallet.toLowerCase()}:${token.toLowerCase()}`,
          10,
          async () => ok(await pnlService.share(wallet, token)),
        ),
      ),
  );

  // GET /api/pnl/:wallet/:token/card.png — the card link previews and the share page show.
  router.on(
    ['GET', 'HEAD'],
    new RegExp(`^\\/api\\/pnl\\/${POSITION}\\/card\\.png$`),
    ({ req, headers, replyCatching }, [, wallet, token]) =>
      replyCatching(async () => {
        const position = `${wallet.toLowerCase()}/${token.toLowerCase()}`;
        const { value, hit } = await readThrough(cache, `pnl:card:${position}`, 60, async () =>
          Buffer.from(
            await pnlService.card(wallet, token, `${siteUrls.appUrl}/pnl/${position}`),
          ).toString('base64'),
        );
        const png = Buffer.from(value, 'base64');
        return new Response(req.method === 'HEAD' ? null : new Uint8Array(png), {
          headers: {
            ...headers,
            ...cacheHeader(hit),
            'Content-Type': 'image/png',
            'Content-Length': String(png.byteLength),
            'Cache-Control': 'public, max-age=60',
            'Cross-Origin-Resource-Policy': 'cross-origin',
          },
        });
      }),
  );
}
