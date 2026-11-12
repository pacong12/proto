import crypto from 'crypto';
import { isAddress, ok, type PriceAlert } from '@goton/shared-types';
import { parseJsonBody, PayloadTooLargeError, requireSocialSession } from '../../../core';
import type { Router } from '../../../core/http/router';
import type { AppContainer } from '../../../app/container';

const KINDS = new Set(['price', 'mcap']);
const DIRECTIONS = new Set(['above', 'below']);

/** HTTP routes of the alerts module: a wallet's price and market-cap alerts on a token. */
export function registerAlertsRoutes(router: Router, deps: AppContainer): void {
  const { repository } = deps;

  // GET /api/alerts?wallet=0x.. — the wallet's alerts (newest first). Polled by the client.
  router.on('GET', '/api/alerts', async ({ url, replyError, replyEnvelope }) => {
    const wallet = url.searchParams.get('wallet') ?? '';
    if (!isAddress(wallet)) return replyError('INVALID_ADDRESS', 'A valid wallet is required', 400);
    const alerts = (await repository.listPriceAlerts?.({ wallet })) ?? [];
    return replyEnvelope(ok(alerts));
  });

  // POST /api/alerts — create an alert for the connected wallet.
  router.on('POST', '/api/alerts', async ({ req, replyError, replyJson }) => {
    try {
      const body = await parseJsonBody<{
        wallet?: string;
        tokenAddress?: string;
        chainId?: number;
        kind?: string;
        direction?: string;
        threshold?: number;
      }>(req, 2048);
      const wallet = String(body.wallet ?? '').trim();
      const tokenAddress = String(body.tokenAddress ?? '').trim();
      if (!isAddress(wallet) || !isAddress(tokenAddress)) {
        return replyError('INVALID_ADDRESS', 'Valid wallet and token addresses are required', 400);
      }
      if (!KINDS.has(String(body.kind)) || !DIRECTIONS.has(String(body.direction))) {
        return replyError(
          'INVALID_ALERT',
          'kind must be price|mcap and direction above|below',
          400,
        );
      }
      const threshold = Number(body.threshold);
      if (!Number.isFinite(threshold) || threshold <= 0) {
        return replyError('INVALID_ALERT', 'threshold must be a positive number', 400);
      }
      const chainId = Number(body.chainId);
      if (!Number.isFinite(chainId) || chainId <= 0) {
        return replyError('INVALID_ALERT', 'a valid chainId is required', 400);
      }
      const sessionError = requireSocialSession(req, wallet, 'set an alert');
      if (sessionError)
        return replyError(sessionError.code, sessionError.message, sessionError.status);

      const alert: PriceAlert = {
        id: crypto.randomUUID(),
        wallet: wallet.toLowerCase() as `0x${string}`,
        tokenAddress: tokenAddress.toLowerCase() as `0x${string}`,
        chainId,
        kind: body.kind as PriceAlert['kind'],
        direction: body.direction as PriceAlert['direction'],
        threshold,
        status: 'open',
        createdAt: Date.now(),
        triggeredAt: null,
      };
      await repository.savePriceAlert?.(alert);
      return replyJson(ok(alert), 201);
    } catch (e) {
      if (e instanceof PayloadTooLargeError) {
        return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
      }
      return replyError('ALERT_ERROR', 'Failed to create alert', 400);
    }
  });

  // DELETE /api/alerts/:id — remove an alert the connected wallet owns.
  router.on(
    'DELETE',
    /^\/api\/alerts\/([a-zA-Z0-9-]+)$/,
    async ({ req, replyError, replyJson }, match) => {
      try {
        const id = match[1];
        const body = await parseJsonBody<{ wallet?: string }>(req, 1024);
        const wallet = String(body.wallet ?? '').trim();
        if (!isAddress(wallet))
          return replyError('INVALID_ADDRESS', 'A valid wallet is required', 400);
        const sessionError = requireSocialSession(req, wallet, 'remove an alert', true);
        if (sessionError)
          return replyError(sessionError.code, sessionError.message, sessionError.status);
        const removed = (await repository.deletePriceAlert?.(id, wallet)) ?? false;
        return replyJson(ok({ removed }));
      } catch {
        return replyError('ALERT_ERROR', 'Failed to remove alert', 400);
      }
    },
  );
}
