import { createPublicClient, http, type PublicClient, custom, createWalletClient, type WalletClient } from 'viem';
import { ROBINHOOD_CHAIN } from '@proto/shared-types';

export const publicClient: PublicClient = createPublicClient({
  chain: {
    id: ROBINHOOD_CHAIN.chainId,
    name: ROBINHOOD_CHAIN.name,
    nativeCurrency: ROBINHOOD_CHAIN.nativeCurrency,
    rpcUrls: { default: { http: [ROBINHOOD_CHAIN.rpcUrl] } },
  },
  transport: http(),
});

export function getWalletClient(): WalletClient | null {
  if (typeof window !== 'undefined' && 'ethereum' in window && window.ethereum) {
    return createWalletClient({
      chain: {
        id: ROBINHOOD_CHAIN.chainId,
        name: ROBINHOOD_CHAIN.name,
        nativeCurrency: ROBINHOOD_CHAIN.nativeCurrency,
        rpcUrls: { default: { http: [ROBINHOOD_CHAIN.rpcUrl] } },
      },
      transport: custom(window.ethereum as never),
    });
  }
  return null;
}
