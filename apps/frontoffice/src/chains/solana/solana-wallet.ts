/**
 * Minimal Solana wallet bridge for injected browser wallets.
 *
 * Kept independent from the EVM wallet store (AppKit / wagmi), which assumes 0x addresses
 * and EIP-1193 providers throughout. No @solana/web3.js import here so the main bundle
 * stays small until the user actually starts a Solana launch.
 */

export interface SolanaPublicKeyLike {
  toBase58(): string;
  toString(): string;
}

/** Shape shared by Phantom, Solflare, Backpack, OKX and Bitget injected Solana providers. */
export interface InjectedSolanaProvider {
  publicKey?: SolanaPublicKeyLike | null;
  isConnected?: boolean;
  connect(options?: {
    onlyIfTrusted?: boolean;
  }): Promise<{ publicKey?: SolanaPublicKeyLike } | void>;
  disconnect(): Promise<void>;
  signTransaction<T>(transaction: T): Promise<T>;
  on?(
    event: 'connect' | 'disconnect' | 'accountChanged',
    handler: (...args: unknown[]) => void,
  ): void;
  off?(
    event: 'connect' | 'disconnect' | 'accountChanged',
    handler: (...args: unknown[]) => void,
  ): void;
}

export interface SolanaWalletOption {
  id: 'phantom' | 'solflare' | 'backpack' | 'okx' | 'bitget';
  name: string;
  installUrl: string;
  resolve(win: Record<string, unknown>): InjectedSolanaProvider | null;
}

type Flagged = InjectedSolanaProvider & Record<string, unknown>;

function pick(value: unknown, flag?: string): InjectedSolanaProvider | null {
  if (!value || typeof value !== 'object') return null;
  const provider = value as Flagged;
  if (typeof provider.connect !== 'function' || typeof provider.signTransaction !== 'function') {
    return null;
  }
  if (flag && provider[flag] !== true) return null;
  return provider;
}

export const SOLANA_WALLETS: SolanaWalletOption[] = [
  {
    id: 'phantom',
    name: 'Phantom',
    installUrl: 'https://phantom.com/download',
    resolve: (win) =>
      pick((win.phantom as { solana?: unknown } | undefined)?.solana, 'isPhantom') ??
      pick(win.solana, 'isPhantom'),
  },
  {
    id: 'solflare',
    name: 'Solflare',
    installUrl: 'https://solflare.com/download',
    resolve: (win) => pick(win.solflare, 'isSolflare'),
  },
  {
    id: 'backpack',
    name: 'Backpack',
    installUrl: 'https://backpack.app/download',
    resolve: (win) => pick(win.backpack, 'isBackpack'),
  },
  {
    id: 'okx',
    name: 'OKX Wallet',
    installUrl: 'https://www.okx.com/web3',
    resolve: (win) => pick((win.okxwallet as { solana?: unknown } | undefined)?.solana),
  },
  {
    id: 'bitget',
    name: 'Bitget Wallet',
    installUrl: 'https://web3.bitget.com/wallet-download',
    resolve: (win) => pick((win.bitkeep as { solana?: unknown } | undefined)?.solana),
  },
];

export function detectSolanaWallets(
  win: Record<string, unknown> | undefined = typeof window === 'undefined'
    ? undefined
    : (window as unknown as Record<string, unknown>),
): Array<SolanaWalletOption & { installed: boolean }> {
  return SOLANA_WALLETS.map((wallet) => ({
    ...wallet,
    installed: Boolean(win && wallet.resolve(win)),
  }));
}

export function getSolanaProvider(
  id: SolanaWalletOption['id'],
  win: Record<string, unknown> | undefined = typeof window === 'undefined'
    ? undefined
    : (window as unknown as Record<string, unknown>),
): InjectedSolanaProvider | null {
  const wallet = SOLANA_WALLETS.find((w) => w.id === id);
  return wallet && win ? wallet.resolve(win) : null;
}

/** Same rejection heuristics as the EVM flow, plus the Solana wallet-adapter error code. */
export function isSolanaUserRejection(err: unknown): boolean {
  const msg = ((err as Error)?.message ?? '').toLowerCase();
  const code = (err as { code?: number })?.code;
  return (
    code === 4001 ||
    msg.includes('user reject') ||
    msg.includes('rejected the request') ||
    msg.includes('user denied') ||
    msg.includes('user cancel') ||
    msg.includes('declined')
  );
}
