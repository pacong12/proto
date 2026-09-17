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
  ARC_CHAIN,
  ARC_TESTNET,
  SUPPORTED_CHAINS,
  type NetworkConfig,
} from '@proto/shared-types';
import { walletProvider, walletChainId, STORAGE_PROVIDER_ID_KEY } from './wallet-store';

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
const arcMainnetChain = toViemChain(ARC_CHAIN);
const arcTestnetChain = toViemChain(ARC_TESTNET);

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

const publicClientArcMainnet: PublicClient = createPublicClient({
  chain: arcMainnetChain,
  transport: http(ARC_CHAIN.rpcUrl),
});

const publicClientArcTestnet: PublicClient = createPublicClient({
  chain: arcTestnetChain,
  transport: http(ARC_TESTNET.rpcUrl),
});

/**
 * Return the PublicClient matching the wallet's active chain.
 * Falls back to mainnet when the chain is unknown or the wallet is disconnected.
 * All readContract and waitForTransactionReceipt calls should use this
 * so they follow the connected chain (fix MED-01 and MED-03).
 */
export function getPublicClient(): PublicClient {
  const chainId = walletChainId.value;
  if (chainId === ARC_CHAIN.chainId) return publicClientArcMainnet;
  if (chainId === ARC_TESTNET.chainId) return publicClientArcTestnet;
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
  let provider = walletProvider.value;

  if (typeof window !== 'undefined') {
    const win = window as unknown as Record<string, unknown>;
    const bitget =
      (win.bitget as { ethereum?: unknown } | undefined)?.ethereum ||
      (win.bitkeep as { ethereum?: unknown } | undefined)?.ethereum ||
      (
        win.ethereum as
          { providers?: Array<{ isBitKeep?: boolean; isBitget?: boolean }> } | undefined
      )?.providers?.find((p) => p.isBitKeep || p.isBitget);

    const storedId =
      (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_PROVIDER_ID_KEY) : '') ||
      '';

    // If Bitget is installed in the browser:
    // Resolve Bitget directly when user preferred Bitget, or when OKX hijacked window.ethereum
    if (bitget) {
      const isExplicitOkx = storedId.toLowerCase().includes('okx');
      const isBitgetPreferred =
        storedId.toLowerCase().includes('bitget') || storedId.toLowerCase().includes('bitkeep');
      const isProviderOkx = Boolean((provider as { isOkxWallet?: boolean } | null)?.isOkxWallet);

      if (isBitgetPreferred || (isProviderOkx && !isExplicitOkx)) {
        provider = bitget as typeof walletProvider.value;
      }
    }
  }

  if (!provider) return null;
  return createWalletClientFromProvider(provider, walletChainId.value ?? undefined);
}
