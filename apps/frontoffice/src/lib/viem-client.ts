import {
  createPublicClient,
  http,
  fallback,
  custom,
  createWalletClient,
  defineChain,
  type PublicClient,
  type WalletClient,
  type TransactionReceipt,
} from 'viem';
import { getWalletClient as getWagmiWalletClient } from '@wagmi/core';
import { wagmiAdapter } from './appkit';
import {
  ROBINHOOD_CHAIN,
  ARC_CHAIN,
  SUPPORTED_CHAINS,
  type NetworkConfig,
} from '@proto/shared-types';
import { walletProvider, walletChainId, STORAGE_PROVIDER_ID_KEY } from './wallet-store';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toViemChain(cfg: NetworkConfig) {
  const rpcList = cfg.rpcUrls && cfg.rpcUrls.length > 0 ? cfg.rpcUrls : [cfg.rpcUrl];
  return defineChain({
    id: cfg.chainId,
    name: cfg.name,
    nativeCurrency: cfg.nativeCurrency,
    rpcUrls: {
      default: { http: rpcList },
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
const arcMainnetChain = toViemChain(ARC_CHAIN);

function createPublicTransport(cfg: NetworkConfig) {
  const urls = cfg.rpcUrls && cfg.rpcUrls.length > 0 ? cfg.rpcUrls : [cfg.rpcUrl];
  if (urls.length === 1) {
    return http(urls[0], { retryCount: 3, retryDelay: 500, timeout: 10_000 });
  }
  return fallback(
    urls.map((url) => http(url, { retryCount: 2, retryDelay: 500, timeout: 8_000 })),
    { rank: false },
  );
}

// ---------------------------------------------------------------------------
// Public clients - one instance per supported chain (fix MED-03)
// ---------------------------------------------------------------------------

const publicClientMainnet: PublicClient = createPublicClient({
  chain: mainnetChain,
  transport: createPublicTransport(ROBINHOOD_CHAIN),
});

const publicClientArcMainnet: PublicClient = createPublicClient({
  chain: arcMainnetChain,
  transport: createPublicTransport(ARC_CHAIN),
});

/**
 * Return the PublicClient matching the wallet's active chain.
 * Falls back to mainnet when the chain is unknown or the wallet is disconnected.
 * All readContract and waitForTransactionReceipt calls should use this
 * so they follow the connected chain (fix MED-01 and MED-03).
 */
export function getPublicClient(explicitChainId?: number): PublicClient {
  const chainId = explicitChainId ?? walletChainId.value;
  if (chainId === ARC_CHAIN.chainId) return publicClientArcMainnet;
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

export async function getWalletClient(): Promise<WalletClient | null> {
  // 1. Primary: 100% Reown AppKit active connector client
  if (wagmiAdapter) {
    try {
      const client = await getWagmiWalletClient(wagmiAdapter.wagmiConfig);
      if (client) {
        return client as unknown as WalletClient;
      }
    } catch {
      // Reown connector not yet connected or in transition
    }
  }

  // 2. Direct isolated provider fallback
  let provider = walletProvider.value;

  if (typeof window !== 'undefined') {
    const win = window as unknown as Record<string, unknown>;
    const bitget =
      (win.bitget as { ethereum?: unknown } | undefined)?.ethereum ||
      (win.bitkeep as { ethereum?: unknown } | undefined)?.ethereum ||
      (win.bitgetWallet as { ethereum?: unknown } | undefined)?.ethereum ||
      (
        win.ethereum as
          { providers?: Array<{ isBitKeep?: boolean; isBitget?: boolean }> } | undefined
      )?.providers?.find((p) => p.isBitKeep || p.isBitget);

    const okx = win.okxwallet as unknown | undefined;

    const storedId =
      (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_PROVIDER_ID_KEY) : '') ||
      '';

    const isExplicitOkx = storedId.toLowerCase().includes('okx');
    const isBitgetPreferred =
      storedId.toLowerCase().includes('bitget') ||
      storedId.toLowerCase().includes('bitkeep') ||
      storedId.toLowerCase().includes('web3');

    // If Bitget is installed in the browser:
    // When user preferred Bitget, OR when user did not explicitly pick OKX,
    // ALWAYS route to Bitget directly to bypass OKX's window.ethereum hijacking.
    if (bitget && (isBitgetPreferred || !isExplicitOkx)) {
      provider = bitget as typeof walletProvider.value;
    } else if (okx && isExplicitOkx) {
      provider = okx as typeof walletProvider.value;
    }
  }

  if (!provider) return null;
  return createWalletClientFromProvider(provider, walletChainId.value ?? undefined);
}

// ---------------------------------------------------------------------------
// Transaction receipt helpers
// ---------------------------------------------------------------------------

export async function waitForReceiptWithFallback(
  client: PublicClient,
  hash: `0x${string}`,
  walletClient?: WalletClient | null,
): Promise<TransactionReceipt | null> {
  // 1. Immediate direct receipt check (often resolves in <150ms if already mined)
  try {
    const immediate = await client.getTransactionReceipt({ hash });
    if (immediate) return immediate;
  } catch {
    // Non-blocking
  }

  // 2. Fallback check from wallet client connector
  if (walletClient) {
    try {
      const rawRcpt = (await walletClient.request({
        method: 'eth_getTransactionReceipt' as never,
        params: [hash] as never,
      })) as unknown as {
        status?: string | number;
        blockNumber?: string | number | bigint;
      } | null;

      if (rawRcpt && rawRcpt.blockNumber) {
        const rcpt = await client.getTransactionReceipt({ hash }).catch(() => null);
        if (rcpt) return rcpt;
      }
    } catch {
      // Non-blocking
    }
  }

  // 3. Fast realtime polling (up to 5 checks every 500ms = 2.5s total)
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      const rcpt = await client.getTransactionReceipt({ hash });
      if (rcpt) return rcpt;
    } catch {
      // Non-blocking
    }
  }

  return null;
}
