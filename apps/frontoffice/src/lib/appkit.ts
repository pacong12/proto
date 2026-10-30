import { defineChain, type AppKitNetwork } from '@reown/appkit/networks';
import { createAppKit } from '@reown/appkit/vue';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { CHAINS, DEFAULT_NETWORK, toViemChain } from '@goton/shared-types';
import { SITE } from './site';

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID as string | undefined;

export const appKitConfigured = Boolean(projectId);

/** AppKit's network shape: the shared viem chain plus its CAIP-2 identifiers. */
const appKitNetworks = CHAINS.map(
  (cfg) =>
    defineChain({
      ...toViemChain(cfg),
      caipNetworkId: `eip155:${cfg.chainId}`,
      chainNamespace: 'eip155',
    }) as AppKitNetwork,
);

const networks = appKitNetworks as [AppKitNetwork, ...AppKitNetwork[]];

const appKitNetworkMap = new Map<number, AppKitNetwork>(
  appKitNetworks.map((net) => [net.id as number, net]),
);

export function getAppKitChain(chainId: number): AppKitNetwork {
  return appKitNetworkMap.get(chainId) ?? appKitNetworkMap.get(DEFAULT_NETWORK.chainId)!;
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
          description: `Goton - Multi-chain token launchpad on ${CHAINS.map((cfg) => cfg.name).join(' & ')}`,
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
        chainImages: Object.fromEntries(
          CHAINS.filter((cfg) => cfg.icon).map((cfg) => [cfg.chainId, cfg.icon!]),
        ),
        connectorImages: {
          injected: '/favicon.png',
          walletConnect: '/favicon.png',
          'io.metamask': '/favicon.png',
          'io.coinbase': '/favicon.png',
        },
      })
    : null;
