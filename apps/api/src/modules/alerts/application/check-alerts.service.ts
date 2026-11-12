import type { Address } from 'viem';
import type { PriceAlert } from '@goton/shared-types';
import type { AlertStorePort } from '../../../core/ports/alert-store.port';
import type { TokenStorePort } from '../../../core/ports/token-store.port';

type AlertRepo = Required<Pick<AlertStorePort, 'listPriceAlerts' | 'markAlertTriggered'>> &
  Pick<TokenStorePort, 'getMarketData'>;

/** Has the value crossed the alert's threshold in its direction? */
export function alertCrossed(alert: PriceAlert, value: number): boolean {
  return alert.direction === 'above' ? value >= alert.threshold : value <= alert.threshold;
}

/**
 * Marks every open alert whose token has reached its target. One market read per token, not per
 * alert. The frontend polls listPriceAlerts and toasts the newly triggered ones.
 */
export class CheckAlertsService {
  constructor(
    private readonly repository: AlertRepo,
    private readonly now: () => number = Date.now,
  ) {}

  async runOnce(): Promise<number> {
    const open = await this.repository.listPriceAlerts({ status: 'open', limit: 500 });
    if (open.length === 0) return 0;

    const byToken = new Map<string, PriceAlert[]>();
    for (const a of open) {
      const key = a.tokenAddress.toLowerCase();
      const list = byToken.get(key);
      if (list) list.push(a);
      else byToken.set(key, [a]);
    }

    let fired = 0;
    for (const [token, alerts] of byToken) {
      const market = await this.repository.getMarketData(token as Address);
      if (!market) continue;
      for (const a of alerts) {
        const value = a.kind === 'mcap' ? market.marketCapUsd : market.priceUsd;
        if (value > 0 && alertCrossed(a, value)) {
          await this.repository.markAlertTriggered(a.id, this.now());
          fired += 1;
        }
      }
    }
    return fired;
  }
}
