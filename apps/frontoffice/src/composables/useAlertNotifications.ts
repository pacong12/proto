import { watch, type Ref } from 'vue';
import type { Router } from 'vue-router';
import type { PriceAlert } from '@goton/shared-types';
import { toast } from '@/components/ui/sonner';
import { apiFetch } from '@/lib/api-client';
import { formatCompactUsd } from '@/lib/utils';
import { useTokenStore } from './useTokenStore';

const POLL_MS = 20_000;

/**
 * Toasts when one of the connected wallet's price / market-cap alerts fires, on any page. Alerts
 * are polled from the API; the first poll only records their state, so reloading never replays old
 * triggers (mirrors useOrderNotifications).
 */
export function useAlertNotifications(
  account: Ref<string | null | undefined>,
  router: Router,
  t: (key: string) => string,
) {
  const tokenStore = useTokenStore();
  const known = new Map<string, PriceAlert['status']>();
  let since = Date.now();
  let timer: ReturnType<typeof setInterval> | null = null;

  function notify(a: PriceAlert) {
    const symbol =
      tokenStore.tokens.value.find(
        (x) => x.token.address.toLowerCase() === a.tokenAddress.toLowerCase(),
      )?.token.symbol ?? 'token';
    const what = a.kind === 'mcap' ? t('alertMcapWord') : t('alertPriceWord');
    const dir = a.direction === 'above' ? '>=' : '<=';
    toast.success(`$${symbol} ${what} ${dir} ${formatCompactUsd(a.threshold)}`, {
      description: t('alertTriggeredDesc'),
      action: { label: t('viewToken'), onClick: () => router.push(`/token/${a.tokenAddress}`) },
    });
  }

  async function poll() {
    const wallet = account.value;
    if (!wallet || (typeof document !== 'undefined' && document.hidden)) return;
    try {
      const res = await apiFetch<{ success: boolean; data: PriceAlert[] }>(
        `/api/alerts?wallet=${wallet}`,
      );
      for (const a of res?.success ? res.data : []) {
        const before = known.get(a.id);
        const justFired =
          a.status === 'triggered' &&
          (before === 'open' || (before === undefined && (a.triggeredAt ?? 0) > since));
        if (justFired) notify(a);
        known.set(a.id, a.status);
      }
    } catch {
      // Non-blocking: a failed poll is retried next tick.
    }
  }

  watch(
    account,
    (wallet) => {
      if (timer) clearInterval(timer);
      known.clear();
      since = Date.now();
      if (wallet) {
        void poll();
        timer = setInterval(poll, POLL_MS);
      }
    },
    { immediate: true },
  );
}
