import { ref } from 'vue';
import type { PriceAlert } from '@goton/shared-types';
import { apiFetch } from '@/lib/api-client';
import { getSessionHeaders } from '@/lib/session';

export interface NewAlert {
  wallet: string;
  tokenAddress: string;
  chainId: number;
  kind: PriceAlert['kind'];
  direction: PriceAlert['direction'];
  threshold: number;
}

/** A wallet's price / market-cap alerts: list, create (wallet session) and remove. */
export function usePriceAlerts() {
  const alerts = ref<PriceAlert[]>([]);
  const loading = ref(false);

  async function load(wallet: string): Promise<void> {
    if (!wallet) {
      alerts.value = [];
      return;
    }
    loading.value = true;
    try {
      const res = await apiFetch<{ success: boolean; data: PriceAlert[] }>(
        `/api/alerts?wallet=${wallet}`,
      );
      alerts.value = res.success ? res.data : [];
    } catch {
      alerts.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function create(input: NewAlert): Promise<PriceAlert | null> {
    const res = await apiFetch<{ success: boolean; data: PriceAlert }>('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getSessionHeaders(input.wallet)) },
      body: JSON.stringify(input),
    });
    if (res.success) {
      alerts.value = [res.data, ...alerts.value];
      return res.data;
    }
    return null;
  }

  async function remove(id: string, wallet: string): Promise<void> {
    await apiFetch(`/api/alerts/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(await getSessionHeaders(wallet)) },
      body: JSON.stringify({ wallet }),
    });
    alerts.value = alerts.value.filter((a) => a.id !== id);
  }

  return { alerts, loading, load, create, remove };
}
