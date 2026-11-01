import { watch, type Ref } from 'vue';
import type { Router } from 'vue-router';
import { getNetworkConfig, type LimitOrderEntity } from '@goton/shared-types';
import { toast } from '@/components/ui/sonner';
import { orderPayout } from '@/lib/limit-orders';
import { apiFetch } from '@/lib/api-client';
import { useTokenStore } from './useTokenStore';

const POLL_MS = 20_000;

/**
 * Toasts when one of the connected wallet's limit, take-profit or stop-loss orders fills, on any
 * page. Orders are polled from the API; the first poll only records their state, so reloading
 * never replays old fills.
 */
export function useOrderNotifications(
  account: Ref<string | null | undefined>,
  router: Router,
  t: (key: string) => string,
) {
  // Plain API reads: this runs in the app shell, so it must not pull the wallet stack
  // (useLimitOrders imports viem) into the first page's JavaScript.
  async function listByOwner(owner: string): Promise<LimitOrderEntity[]> {
    try {
      const res = await apiFetch<{ success: boolean; data: LimitOrderEntity[] }>(
        `/api/orders?owner=${owner}`,
      );
      return res?.success ? res.data : [];
    } catch {
      return [];
    }
  }
  const tokenStore = useTokenStore();
  const known = new Map<string, LimitOrderEntity['status']>();
  let since = Date.now();
  let timer: ReturnType<typeof setInterval> | null = null;

  function legLabel(o: LimitOrderEntity): string {
    if (o.filledLeg === 'stopLoss') return t('stopLossLabel');
    if (o.filledLeg === 'takeProfit') return t('takeProfitLabel');
    return t('limitBuyLabel');
  }

  function notify(o: LimitOrderEntity) {
    const token = tokenStore.tokens.value.find(
      (x) => x.token.address.toLowerCase() === o.token.toLowerCase(),
    )?.token;
    const symbol = token?.symbol ?? 'token';
    const payout = orderPayout(o, symbol, getNetworkConfig(o.chainId));
    toast.success(`${legLabel(o)} ${t('orderFilledToast')}: $${symbol}`, {
      description: payout ? `${t('orderReceived')} ${payout}` : undefined,
      action: { label: t('viewToken'), onClick: () => router.push(`/token/${o.token}`) },
    });
  }

  async function poll() {
    const owner = account.value;
    if (!owner || (typeof document !== 'undefined' && document.hidden)) return;
    const orders = await listByOwner(owner);
    for (const o of orders) {
      const before = known.get(o.key);
      const justFilled =
        o.status === 'filled' &&
        (before === 'open' || (before === undefined && (o.updatedAt ?? 0) > since));
      if (justFilled) notify(o);
      known.set(o.key, o.status);
    }
  }

  watch(
    () => account.value,
    (owner) => {
      if (timer) clearInterval(timer);
      timer = null;
      known.clear();
      since = Date.now();
      if (!owner) return;
      void poll();
      timer = setInterval(poll, POLL_MS);
    },
    { immediate: true },
  );
}
