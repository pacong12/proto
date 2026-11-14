import { reactive } from 'vue';
import { apiFetch } from '@/lib/api-client';
import type { ProfileStorageData } from '@/components/profile/types';

// One copy of each wallet's saved profile for the whole app, so the navbar shows the same name
// and photo as /profile and picks up an edit the moment it is saved.
const profiles = reactive(new Map<string, ProfileStorageData | null>());
const inflight = new Map<string, Promise<ProfileStorageData | null>>();

function key(address: string): string {
  return address.toLowerCase();
}

/** The cached profile; null when the wallet has none (or it has not loaded yet). */
export function getProfile(address?: string | null): ProfileStorageData | null {
  return address ? (profiles.get(key(address)) ?? null) : null;
}

/** Records a profile just loaded, saved or erased, so every view showing it updates. */
export function setProfile(address: string, profile: ProfileStorageData | null): void {
  profiles.set(key(address), profile);
}

/** Loads a wallet's profile from the API once; later calls reuse it unless forced. */
export function loadProfile(address: string, force = false): Promise<ProfileStorageData | null> {
  const k = key(address);
  if (!force && profiles.has(k)) return Promise.resolve(profiles.get(k) ?? null);
  const pending = inflight.get(k);
  if (pending) return pending;
  const request = apiFetch<{ success: boolean; data: { profile: ProfileStorageData | null } }>(
    `/api/profiles/${k}`,
  )
    .then((res) => {
      const profile = res.data?.profile ?? null;
      profiles.set(k, profile);
      return profile;
    })
    .finally(() => inflight.delete(k));
  inflight.set(k, request);
  return request;
}
