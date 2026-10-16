import { shallowRef } from 'vue';
import { isStoredConnectionActive } from './wallet-store';

/**
 * Reown AppKit (with wagmi and WalletConnect) is ~800 KB and used to load before the first paint.
 * It is now loaded on demand: when the user opens the wallet modal, switches network or signs, and
 * on idle for returning users whose session must be restored. First-time visitors browse without it.
 */
export const appKitConfigured = Boolean(import.meta.env.VITE_REOWN_PROJECT_ID);

type AppKitModule = typeof import('./appkit');
type AppKitInstance = NonNullable<AppKitModule['appKit']>;

/** AppKit state mirrored into Vue refs once AppKit is loaded. */
export const appKitAccount = shallowRef<{ address?: string; status?: string } | null>(null);
export const appKitChainId = shallowRef<string | number | undefined>(undefined);
export const appKitWalletProvider = shallowRef<unknown>(null);

let modulePromise: Promise<AppKitModule> | null = null;

/** Loads the AppKit module once and starts mirroring its account, network and provider state. */
export function loadAppKit(): Promise<AppKitModule> {
  modulePromise ??= import('./appkit').then((mod) => {
    if (mod.appKit) bridgeState(mod.appKit);
    return mod;
  });
  return modulePromise;
}

/** The AppKit instance, or null when no Reown project id is configured. */
export async function getAppKit(): Promise<AppKitInstance | null> {
  if (!appKitConfigured) return null;
  return (await loadAppKit()).appKit;
}

function bridgeState(kit: AppKitInstance): void {
  const account = kit.getAccount();
  appKitAccount.value = account ? { address: account.address, status: account.status } : null;
  appKitChainId.value = kit.getChainId();
  appKitWalletProvider.value = kit.getWalletProvider() ?? null;

  kit.subscribeAccount((state) => {
    appKitAccount.value = { address: state.address, status: state.status };
  }, 'eip155');
  kit.subscribeNetwork((state) => {
    appKitChainId.value = state.chainId;
  });
  kit.subscribeProviders((providers) => {
    appKitWalletProvider.value = providers?.eip155 ?? null;
  });
}

/** Restores a returning user's wallet session without delaying the first paint. */
export function preloadAppKitForReturningUser(): void {
  if (!appKitConfigured || typeof window === 'undefined' || !isStoredConnectionActive()) return;
  const load = () => void loadAppKit();
  const schedule = () =>
    'requestIdleCallback' in window
      ? window.requestIdleCallback(load, { timeout: 3000 })
      : setTimeout(load, 1000);
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
}
