import {
  createPublicClient,
  http,
  custom,
  createWalletClient,
  defineChain,
  type PublicClient,
  type WalletClient,
} from 'viem';
import {
  ROBINHOOD_CHAIN,
  ROBINHOOD_TESTNET,
  SUPPORTED_CHAINS,
  type NetworkConfig,
} from '@proto/shared-types';
import { walletProvider, walletChainId } from './wallet-store';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toViemChain(cfg: NetworkConfig) {
  return defineChain({
    id: cfg.chainId,
    name: cfg.name,
    nativeCurrency: cfg.nativeCurrency,
    rpcUrls: {
      default: { http: [cfg.rpcUrl] },
    },
    blockExplorers: {
      default: {
        name: 'Blockscout',
        url: cfg.blockExplorer,
      },
    },
  });
}

const mainnetChain = toViemChain(ROBINHOOD_CHAIN);
const testnetChain = toViemChain(ROBINHOOD_TESTNET);

// ---------------------------------------------------------------------------
// Public clients - one instance per supported chain (fix MED-03)
// ---------------------------------------------------------------------------

const publicClientMainnet: PublicClient = createPublicClient({
  chain: mainnetChain,
  transport: http(ROBINHOOD_CHAIN.rpcUrl),
});

const publicClientTestnet: PublicClient = createPublicClient({
  chain: testnetChain,
  transport: http(ROBINHOOD_TESTNET.rpcUrl),
});

/**
 * Return the PublicClient matching the wallet's active chain.
 * Falls back to mainnet when the chain is unknown or the wallet is disconnected.
 * All readContract and waitForTransactionReceipt calls should use this
 * so they follow the connected chain (fix MED-01 and MED-03).
 */
export function getPublicClient(): PublicClient {
  const chainId = walletChainId.value;
  if (chainId === ROBINHOOD_TESTNET.chainId) return publicClientTestnet;
  return publicClientMainnet;
}

/**
 * Static alias kept for backward compatibility in places that always target mainnet.
 * Prefer getPublicClient() for any chain-sensitive call.
 */
export const publicClient: PublicClient = publicClientMainnet;

// ---------------------------------------------------------------------------
// Wallet clients
// ---------------------------------------------------------------------------

export function createWalletClientFromProvider(provider: unknown, chainId?: number): WalletClient {
  const cfg = chainId ? SUPPORTED_CHAINS[chainId] : undefined;
  const chain = cfg ? toViemChain(cfg) : mainnetChain;
  return createWalletClient({
    chain,
    transport: custom(provider as never),
  });
}

export function getWalletClient(): WalletClient | null {
  const provider = walletProvider.value;
  if (!provider) return null;
  return createWalletClientFromProvider(provider, walletChainId.value ?? undefined);
}
