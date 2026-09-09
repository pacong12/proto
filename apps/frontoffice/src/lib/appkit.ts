import { defineChain, type AppKitNetwork } from '@reown/appkit/networks';
import { createAppKit } from '@reown/appkit/vue';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { ROBINHOOD_CHAIN } from '@proto/shared-types';

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID;

export const appKitConfigured = Boolean(projectId);

export const robinhoodAppKitChain = defineChain({
  id: ROBINHOOD_CHAIN.chainId,
  caipNetworkId: `eip155:${ROBINHOOD_CHAIN.chainId}`,
  chainNamespace: 'eip155',
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
}) as AppKitNetwork;

const networks = [robinhoodAppKitChain] as [AppKitNetwork, ...AppKitNetwork[]];

if (!projectId) {
  console.warn('VITE_REOWN_PROJECT_ID is missing; AppKit wallet modal is disabled.');
} else {
  const wagmiAdapter = new WagmiAdapter({
    networks,
    projectId,
  });

  createAppKit({
    adapters: [wagmiAdapter],
    networks,
    projectId,
    metadata: {
      name: 'proto',
      description: 'Proto - Fixed-supply token launchpad on Robinhood Chain',
      url: 'http://localhost:3000',
      icons: ['/favicon.svg'],
    },
    features: {
      analytics: false,
    },
    enableWalletGuide: true,
    enableNetworkSwitch: true,
    enableReconnect: true,
    enableMobileFullScreen: true,
    chainImages: {
      [ROBINHOOD_CHAIN.chainId]: '/favicon.png',
    },
    connectorImages: {
      injected: '/favicon.png',
      walletConnect: '/favicon.png',
      'io.metamask': '/favicon.png',
      'io.coinbase': '/favicon.png',
    },
  });
}
