import { sendNotification, setVapidDetails, type PushSubscription } from 'web-push';
import type { PriceAlert } from '@goton/shared-types';
import type { PushStorePort } from '../../../core/ports/push-store.port';

export interface PushPayload {
  title: string;
  body: string;
  /** Relative path the notification opens, e.g. `/token/0x…`. */
  url: string;
}

/** Push-service responses that mean the subscription is gone and should be pruned. */
const GONE_STATUS = new Set([404, 410]);

/**
 * Sends browser Web Push notifications. Disabled (a safe no-op) unless all three VAPID env vars are
 * set, so the API runs fine without push configured. Expired subscriptions are pruned on send.
 */
export class PushSender {
  readonly enabled: boolean;
  readonly publicKey: string;

  constructor(
    private readonly store: Pick<
      PushStorePort,
      'listPushSubscriptionsByWallet' | 'deletePushSubscription'
    >,
    env: { publicKey?: string; privateKey?: string; subject?: string } = {},
  ) {
    const publicKey = env.publicKey ?? '';
    const privateKey = env.privateKey ?? '';
    const subject = env.subject ?? 'mailto:support@goton.fun';
    this.publicKey = publicKey;
    this.enabled = Boolean(publicKey && privateKey);
    if (this.enabled) {
      setVapidDetails(subject, publicKey, privateKey);
    }
  }

  /** Pushes a payload to every device subscribed by `wallet`. Prunes dead subscriptions. */
  async sendToWallet(wallet: string, payload: PushPayload): Promise<number> {
    if (!this.enabled) return 0;
    const subs = (await this.store.listPushSubscriptionsByWallet?.(wallet)) ?? [];
    if (subs.length === 0) return 0;
    const body = JSON.stringify(payload);
    let sent = 0;
    await Promise.all(
      subs.map(async (s) => {
        const subscription: PushSubscription = {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        };
        try {
          await sendNotification(subscription, body);
          sent += 1;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status && GONE_STATUS.has(status)) {
            await this.store.deletePushSubscription?.(s.endpoint);
          }
        }
      }),
    );
    return sent;
  }

  /** Builds and sends the notification for a freshly triggered alert. */
  async notifyAlert(alert: PriceAlert, symbol?: string): Promise<void> {
    if (!this.enabled) return;
    const what = alert.kind === 'mcap' ? 'market cap' : 'price';
    const token = symbol ? `$${symbol}` : 'A token you watch';
    await this.sendToWallet(alert.wallet, {
      title: 'Goton price alert',
      body: `${token} crossed your ${what} target (${alert.direction} $${alert.threshold}).`,
      url: `/token/${alert.tokenAddress}`,
    });
  }
}
