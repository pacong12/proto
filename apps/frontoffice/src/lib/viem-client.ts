import {
  createPublicClient,
  http,
  fallback,
  custom,
  createWalletClient,
  type PublicClient,
  type WalletClient,
  type TransactionReceipt,
} from 'viem';
import { appKitConfigured, loadAppKit } from './appkit-loader';
import {
  CHAINS,
  DEFAULT_NETWORK,
  SUPPORTED_CHAINS,
  rpcUrlsFor,
  toViemChain,
  type NetworkConfig,
} from '@goton/shared-types';
import { walletProvider, walletChainId, STORAGE_PROVIDER_ID_KEY } from './wallet-store';
import { assertTermsAccepted } from './consent';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function createPublicTransport(cfg: NetworkConfig) {
  const urls = rpcUrlsFor(cfg);
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

const publicClients = new Map<number, PublicClient>(
  CHAINS.map((cfg) => [
    cfg.chainId,
    createPublicClient({ chain: toViemChain(cfg), transport: createPublicTransport(cfg) }),
  ]),
);

/**
 * Return the PublicClient matching the wallet's active chain.
 * Falls back to the default network when the chain is unknown or the wallet is disconnected.
 * All readContract and waitForTransactionReceipt calls should use this
 * so they follow the connected chain (fix MED-01 and MED-03).
 */
export function getPublicClient(explicitChainId?: number): PublicClient {
  const chainId = explicitChainId ?? walletChainId.value;
  return (
    (chainId ? publicClients.get(chainId) : undefined) ??
    publicClients.get(DEFAULT_NETWORK.chainId)!
  );
}

// ---------------------------------------------------------------------------
// Wallet clients
// ---------------------------------------------------------------------------

/** Wallet actions that sign or send something on the user's behalf. */
const GATED_WALLET_ACTIONS = new Set<PropertyKey>([
  'writeContract',
  'sendTransaction',
  'signTransaction',
  'deployContract',
  'signMessage',
  'signTypedData',
]);

/**
 * Every wallet client handed to the app passes through here: signing or sending rejects (and opens
 * the terms dialog) until the Terms of Service and Privacy Policy are accepted.
 */
export function guardWalletWrites<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function' || !GATED_WALLET_ACTIONS.has(prop)) return value;
      return (...args: unknown[]) => {
        try {
          assertTermsAccepted();
        } catch (e) {
          return Promise.reject(e);
        }
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
}

function createWalletClientFromProvider(provider: unknown, chainId?: number): WalletClient {
  return createWalletClient({
    chain: toViemChain((chainId ? SUPPORTED_CHAINS[chainId] : undefined) ?? DEFAULT_NETWORK),
    transport: custom(provider as never),
  });
}

export async function getWalletClient(): Promise<WalletClient | null> {
  // 1. Primary: 100% Reown AppKit active connector client
  if (appKitConfigured) {
    try {
      const [{ wagmiAdapter }, { getWalletClient: getWagmiWalletClient }] = await Promise.all([
        loadAppKit(),
        import('@wagmi/core'),
      ]);
      if (!wagmiAdapter) throw new Error('AppKit unavailable');
      const client = await getWagmiWalletClient(wagmiAdapter.wagmiConfig);
      if (client) {
        return guardWalletWrites(client as unknown as WalletClient);
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
  return guardWalletWrites(
    createWalletClientFromProvider(provider, walletChainId.value ?? undefined),
  );
}

// ---------------------------------------------------------------------------
// Transaction receipt helpers
// ---------------------------------------------------------------------------

/** Upper bound for waiting on a receipt before treating a transaction as still pending. */
const RECEIPT_TIMEOUT_MS = 120_000;

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

  // 4. FO-11: slow blocks are normal; keep waiting (viem polls with backoff) instead of reporting
  //    a mined transaction as missing after 2.5s.
  try {
    return await client.waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS });
  } catch {
    // Timed out: the caller treats the transaction as still pending.
  }
  return null;
}
