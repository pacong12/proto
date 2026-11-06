import type { WalletProviderLike } from './wallet-store';

export interface Eip6963ProviderDetail {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: WalletProviderLike;
}

/** How long a page reload waits for the chosen wallet to answer before treating it as gone. */
const ANNOUNCE_TIMEOUT_MS = 1_000;

/**
 * Asks the installed wallets to announce themselves (EIP-6963) and resolves with the one the user
 * chose, or null if it does not answer. `window.ethereum` cannot do this: with several wallets
 * installed it belongs to whichever extension claimed it last.
 */
export function findAnnouncedProvider(
  walletId: string,
  timeoutMs = ANNOUNCE_TIMEOUT_MS,
): Promise<WalletProviderLike | null> {
  return new Promise((resolve) => {
    const finish = (provider: WalletProviderLike | null) => {
      clearTimeout(timer);
      window.removeEventListener('eip6963:announceProvider', onAnnounce);
      resolve(provider);
    };
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
      if (detail?.provider && (detail.info?.rdns || detail.info?.uuid) === walletId) {
        finish(detail.provider);
      }
    };
    const timer = setTimeout(() => finish(null), timeoutMs);

    window.addEventListener('eip6963:announceProvider', onAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  });
}
