import {
  createPublicClient,
  http,
  custom,
  createWalletClient,
  defineChain,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { ROBINHOOD_CHAIN } from '@proto/shared-types';
import { walletProvider } from './wallet-store';

const chain = defineChain({
  id: ROBINHOOD_CHAIN.chainId,
  name: ROBINHOOD_CHAIN.name,
  nativeCurrency: ROBINHOOD_CHAIN.nativeCurrency,
  rpcUrls: {
    default: { http: [ROBINHOOD_CHAIN.rpcUrl] },
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: ROBINHOOD_CHAIN.blockExplorer,
    },
  },
});

export const publicClient: PublicClient = createPublicClient({
  chain,
  transport: http(ROBINHOOD_CHAIN.rpcUrl),
});

export function createWalletClientFromProvider(provider: unknown): WalletClient {
  return createWalletClient({
    chain,
    transport: custom(provider as never),
  });
}

export function getWalletClient(): WalletClient | null {
  const provider = walletProvider.value;
  return provider ? createWalletClientFromProvider(provider) : null;
}
