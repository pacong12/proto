import { apiFetch } from './api-client';
import { getSessionHeaders } from './session';

/** Whether this browser can do Web Push at all (service worker + PushManager + Notification). */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Current notification permission, or 'unsupported'. */
export function pushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/** base64url VAPID key → the Uint8Array the PushManager wants as applicationServerKey. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

let registration: ServiceWorkerRegistration | null = null;

/** Registers the service worker once; a no-op (returns null) where push is unsupported. */
export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  if (registration) return registration;
  try {
    registration = await navigator.serviceWorker.register('/sw.js');
    return registration;
  } catch {
    return null;
  }
}

/** Is this browser currently subscribed to push? */
export async function isPushEnabled(): Promise<boolean> {
  const reg = await ensureServiceWorker();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return Boolean(sub);
}

/**
 * Enables push for `wallet`: requests permission, subscribes, and registers the subscription with
 * the API. Returns false if unsupported, denied, or the server has push disabled.
 */
export async function enablePush(wallet: string): Promise<boolean> {
  const reg = await ensureServiceWorker();
  if (!reg) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const vapid = await apiFetch<{ success: boolean; data: { publicKey: string; enabled: boolean } }>(
    '/api/push/vapid-public-key',
  ).catch(() => null);
  if (!vapid?.success || !vapid.data.enabled || !vapid.data.publicKey) return false;

  const existing = await reg.pushManager.getSubscription();
  // Cast: the DOM lib types applicationServerKey as BufferSource; the Uint8Array satisfies it.
  const applicationServerKey = urlBase64ToUint8Array(vapid.data.publicKey) as BufferSource;
  const subscription =
    existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }));

  const res = await apiFetch<{ success: boolean }>('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getSessionHeaders(wallet)) },
    body: JSON.stringify({ wallet, subscription: subscription.toJSON() }),
  }).catch(() => null);

  return Boolean(res?.success);
}

/** Disables push for this browser: unsubscribes locally and tells the API to drop it. */
export async function disablePush(wallet: string): Promise<void> {
  const reg = await ensureServiceWorker();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  await apiFetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getSessionHeaders(wallet)) },
    body: JSON.stringify({ wallet, endpoint }),
  }).catch(() => {});
}
