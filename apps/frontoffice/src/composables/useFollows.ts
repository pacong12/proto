import { ref } from 'vue';
import { apiFetch } from '@/lib/api-client';
import { getSessionHeaders } from '@/lib/session';

export interface FollowStats {
  followers: number;
  following: number;
  isFollowing: boolean;
}

export interface FollowRow {
  address: string;
  since: number;
  identity: { name: string; displayName: string };
}

/** Followers / following for one profile, and the viewer's follow toggle (wallet session). */
export function useFollows() {
  const stats = ref<FollowStats>({ followers: 0, following: 0, isFollowing: false });
  const busy = ref(false);
  const error = ref<string | null>(null);

  async function load(address: string, viewer?: string | null) {
    try {
      const q = viewer ? `?viewer=${viewer}` : '';
      const res = await apiFetch<{ success: boolean; data: FollowStats }>(
        `/api/users/${address}/follows${q}`,
      );
      if (res.success) stats.value = res.data;
    } catch {
      // Keep the last known counts.
    }
  }

  async function toggle(address: string, viewer: string) {
    busy.value = true;
    error.value = null;
    try {
      const res = await apiFetch<{
        success: boolean;
        data: { following: boolean; followers: number };
        error?: { message?: string };
      }>(`/api/users/${address}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getSessionHeaders(viewer)) },
        body: JSON.stringify({ userAddress: viewer }),
      });
      if (res.success) {
        stats.value = {
          ...stats.value,
          isFollowing: res.data.following,
          followers: res.data.followers,
        };
      } else {
        error.value = res.error?.message ?? 'Could not update follow';
      }
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      if (!/user rejected|denied/i.test(msg)) error.value = msg.split('\n')[0];
    } finally {
      busy.value = false;
    }
  }

  async function list(address: string, direction: 'followers' | 'following') {
    try {
      const res = await apiFetch<{ success: boolean; data: FollowRow[] }>(
        `/api/users/${address}/${direction}`,
      );
      return res.success ? res.data : [];
    } catch {
      return [];
    }
  }

  return { stats, busy, error, load, toggle, list };
}
