import { isAddress, ok } from '@goton/shared-types';
import { parseJsonBody, PayloadTooLargeError, requireSocialSession } from '../../../core';
import type { Router } from '../../../core/http/router';
import type { AppContainer } from '../../../app/container';
import type { PushSender } from '../application/push-sender';

interface SubscribeBody {
  wallet?: string;
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
}

/** HTTP routes of the push module: a wallet registers browser Web Push subscriptions for alerts. */
export function registerPushRoutes(
  router: Router,
  deps: AppContainer,
  pushSender: Pick<PushSender, 'enabled' | 'publicKey'>,
): void {
  const { repository } = deps;

  // GET /api/push/vapid-public-key — the VAPID public key the browser needs to subscribe.
  router.on('GET', '/api/push/vapid-public-key', async ({ replyEnvelope }) =>
    replyEnvelope(ok({ publicKey: pushSender.publicKey, enabled: pushSender.enabled })),
  );

  // POST /api/push/subscribe — register a subscription for the connected wallet.
  router.on('POST', '/api/push/subscribe', async ({ req, replyError, replyJson }) => {
    try {
      if (!pushSender.enabled) {
        return replyError('PUSH_DISABLED', 'Push notifications are not configured', 503);
      }
      const body = await parseJsonBody<SubscribeBody>(req, 4096);
      const wallet = String(body.wallet ?? '').trim();
      const endpoint = String(body.subscription?.endpoint ?? '').trim();
      const p256dh = String(body.subscription?.keys?.p256dh ?? '').trim();
      const auth = String(body.subscription?.keys?.auth ?? '').trim();
      if (!isAddress(wallet)) {
        return replyError('INVALID_ADDRESS', 'A valid wallet is required', 400);
      }
      if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) {
        return replyError('INVALID_SUBSCRIPTION', 'A valid push subscription is required', 400);
      }
      const sessionError = requireSocialSession(req, wallet, 'enable notifications');
      if (sessionError)
        return replyError(sessionError.code, sessionError.message, sessionError.status);

      await repository.savePushSubscription?.({
        endpoint,
        wallet: wallet.toLowerCase(),
        p256dh,
        auth,
        createdAt: Date.now(),
      });
      return replyJson(ok({ subscribed: true }), 201);
    } catch (e) {
      if (e instanceof PayloadTooLargeError) {
        return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
      }
      return replyError('PUSH_ERROR', 'Failed to subscribe', 400);
    }
  });

  // POST /api/push/unsubscribe — remove a subscription the connected wallet owns.
  router.on('POST', '/api/push/unsubscribe', async ({ req, replyError, replyJson }) => {
    try {
      const body = await parseJsonBody<{ wallet?: string; endpoint?: string }>(req, 4096);
      const wallet = String(body.wallet ?? '').trim();
      const endpoint = String(body.endpoint ?? '').trim();
      if (!isAddress(wallet)) {
        return replyError('INVALID_ADDRESS', 'A valid wallet is required', 400);
      }
      if (!endpoint) return replyError('INVALID_SUBSCRIPTION', 'An endpoint is required', 400);
      const sessionError = requireSocialSession(req, wallet, 'disable notifications', true);
      if (sessionError)
        return replyError(sessionError.code, sessionError.message, sessionError.status);
      const removed = (await repository.deletePushSubscription?.(endpoint)) ?? false;
      return replyJson(ok({ removed }));
    } catch {
      return replyError('PUSH_ERROR', 'Failed to unsubscribe', 400);
    }
  });
}
