import { defineChain, type AppKitNetwork } from '@reown/appkit/networks';
import { createAppKit } from '@reown/appkit/vue';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { ROBINHOOD_CHAIN, ARC_CHAIN } from '@goton/shared-types';
import { SITE } from './site';

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID as string | undefined;

export const appKitConfigured = Boolean(projectId);

export const robinhoodAppKitChain = defineChain({
  id: ROBINHOOD_CHAIN.chainId,
  caipNetworkId: `eip155:${ROBINHOOD_CHAIN.chainId}`,
  chainNamespace: 'eip155',
  name: ROBINHOOD_CHAIN.name,
  nativeCurrency: ROBINHOOD_CHAIN.nativeCurrency,
  rpcUrls: {
    default: {
      http:
        ROBINHOOD_CHAIN.rpcUrls && ROBINHOOD_CHAIN.rpcUrls.length > 0
          ? ROBINHOOD_CHAIN.rpcUrls
          : [ROBINHOOD_CHAIN.rpcUrl],
    },
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
    default: {
      http:
        ARC_CHAIN.rpcUrls && ARC_CHAIN.rpcUrls.length > 0 ? ARC_CHAIN.rpcUrls : [ARC_CHAIN.rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: ARC_CHAIN.blockExplorer,
    },
  },
}) as AppKitNetwork;

const networks = [robinhoodAppKitChain, arcAppKitChain] as [AppKitNetwork, ...AppKitNetwork[]];

const appKitNetworkMap = new Map<number, AppKitNetwork>([
  [robinhoodAppKitChain.id as number, robinhoodAppKitChain],
  [arcAppKitChain.id as number, arcAppKitChain],
]);

export function registerAppKitNetwork(net: AppKitNetwork): void {
  appKitNetworkMap.set(net.id as number, net);
}

export function getAppKitChain(chainId: number): AppKitNetwork {
  return appKitNetworkMap.get(chainId) ?? robinhoodAppKitChain;
}

export const wagmiAdapter = projectId
  ? new WagmiAdapter({
      networks,
      projectId,
    })
  : null;

export const appKit =
  projectId && wagmiAdapter
    ? createAppKit({
        adapters: [wagmiAdapter],
        networks,
        projectId,
        metadata: {
          name: 'goton',
          description: 'Goton - Multi-chain token launchpad on Robinhood & Arc Chain',
          // Must match the domain the app runs on (WalletConnect domain verification).
          url: typeof window !== 'undefined' ? window.location.origin : SITE.appUrl,
          icons: ['/favicon.svg'],
        },
        // Wallet connections only: no email or social logins (embedded wallets), and none of the
        // modal's extra flows (swap, buy crypto, send/receive, activity), which trading here
        // does not use.
        features: {
          analytics: false,
          email: false,
          socials: false,
          emailShowWallets: false,
          swaps: false,
          onramp: false,
          send: false,
          receive: false,
          history: false,
          smartSessions: false,
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
      })
    : null;
