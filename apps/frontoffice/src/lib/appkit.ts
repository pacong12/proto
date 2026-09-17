import { defineChain, type AppKitNetwork } from '@reown/appkit/networks';
import { createAppKit } from '@reown/appkit/vue';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { ROBINHOOD_CHAIN, ARC_CHAIN } from '@proto/shared-types';

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

export const arcAppKitChain = defineChain({
  id: ARC_CHAIN.chainId,
  caipNetworkId: `eip155:${ARC_CHAIN.chainId}`,
  chainNamespace: 'eip155',
  name: ARC_CHAIN.name,
  nativeCurrency: ARC_CHAIN.nativeCurrency,
  rpcUrls: {
    default: { http: [ARC_CHAIN.rpcUrl] },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: ARC_CHAIN.blockExplorer,
    },
  },
}) as AppKitNetwork;

const networks = [robinhoodAppKitChain, arcAppKitChain] as [AppKitNetwork, ...AppKitNetwork[]];

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
      description: 'Proto - Multi-chain token launchpad on Robinhood & Arc Chain',
      url:
        (import.meta.env.VITE_APP_URL as string | undefined) ??
        (typeof window !== 'undefined' ? window.location.origin : 'https://proto.family'),
      icons: ['/favicon.svg'],
    },
    features: {
      analytics: false,
      email: true,
      socials: ['google', 'x', 'discord', 'github', 'apple', 'farcaster'],
      emailShowWallets: true,
    },
    featuredWalletIds: [
      '38f5d18bd8522c244bdd70cb4a68e0e7188651522e1e7c704d3252b861635166', // Bitget Wallet
      'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
      '971e689d0a5be527bac79629b4ee9b925e82208e5168b73349669cccd711e5f', // OKX Wallet
    ],
    enableWalletGuide: true,
    enableNetworkSwitch: true,
    enableReconnect: true,
    enableMobileFullScreen: true,
    chainImages: {
      [ROBINHOOD_CHAIN.chainId]: '/chains/robinhood.svg',
      [ARC_CHAIN.chainId]: '/chains/arc.svg',
    },
    connectorImages: {
      injected: '/favicon.png',
      walletConnect: '/favicon.png',
      'io.metamask': '/favicon.png',
      'io.coinbase': '/favicon.png',
    },
  });
}
