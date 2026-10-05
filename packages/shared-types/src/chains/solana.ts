import { getEnv } from './env';

export type SolanaCluster = 'mainnet-beta' | 'devnet' | 'testnet';

/**
 * Solana is not an EVM chain, so it does not fit `NetworkConfig` (0x addresses,
 * Uniswap contracts, wei amounts). It gets its own config shape instead.
 */
export interface SolanaNetworkConfig {
  /** Stable identifier used in routes and the network selector. */
  id: 'solana';
  name: string;
  cluster: SolanaCluster;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  launchConfig: {
    /** Whole-token supply minted once to the creator. */
    supply: bigint;
    decimals: number;
    /** Mint authority is removed after minting so the supply can never grow. */
    revokeMintAuthority: boolean;
    /** No freeze authority is ever set, so holder accounts cannot be frozen. */
    disableFreezeAuthority: boolean;
  };
}

/** Limits enforced by the SPL Token-2022 metadata extension and common wallets. */
export const SOLANA_METADATA_LIMITS = {
  nameMaxLength: 32,
  symbolMaxLength: 10,
  uriMaxLength: 200,
  descriptionMaxLength: 1000,
} as const;

const DEFAULT_RPC: Record<SolanaCluster, string> = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
};

function resolveCluster(value: string): SolanaCluster {
  return value === 'devnet' || value === 'testnet' ? value : 'mainnet-beta';
}

const cluster = resolveCluster(getEnv('SOLANA_CLUSTER', 'mainnet-beta'));

/**
 * Solana network used for SPL token launches.
 * Cluster and RPC are read from environment variables (SOLANA_CLUSTER, SOLANA_RPC_URL).
 */
export const SOLANA_NETWORK: SolanaNetworkConfig = {
  id: 'solana',
  name:
    cluster === 'mainnet-beta' ? 'Solana' : `Solana ${cluster[0].toUpperCase()}${cluster.slice(1)}`,
  cluster,
  rpcUrl: getEnv('SOLANA_RPC_URL', DEFAULT_RPC[cluster]),
  blockExplorer: getEnv('SOLANA_BLOCK_EXPLORER_URL', 'https://solscan.io'),
  nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
  launchConfig: {
    supply: 1_000_000_000n,
    decimals: 9,
    revokeMintAuthority: true,
    disableFreezeAuthority: true,
  },
};

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Decode a base58 string to bytes, or return null when it contains invalid characters. */
function decodeBase58(value: string): Uint8Array | null {
  let num = 0n;
  for (const char of value) {
    const index = BASE58_ALPHABET.indexOf(char);
    if (index === -1) return null;
    num = num * 58n + BigInt(index);
  }
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num % 256n));
    num /= 256n;
  }
  for (const char of value) {
    if (char !== '1') break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

/** True when the value is a base58-encoded 32-byte Solana public key. */
export function isSolanaAddress(value?: string | null): boolean {
  if (!value || value.length < 32 || value.length > 44) return false;
  const bytes = decodeBase58(value);
  return bytes !== null && bytes.length === 32;
}

/** Build an explorer link for an account or transaction signature on the configured cluster. */
export function solanaExplorerUrl(
  kind: 'token' | 'account' | 'tx',
  value: string,
  network: SolanaNetworkConfig = SOLANA_NETWORK,
): string {
  const query = network.cluster === 'mainnet-beta' ? '' : `?cluster=${network.cluster}`;
  return `${network.blockExplorer.replace(/\/$/, '')}/${kind}/${value}${query}`;
}

export interface SolanaTokenDraft {
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
}

/**
 * Validate user input for a Solana token launch.
 * Returns a list of human-readable problems; an empty list means the draft is valid.
 */
export function validateSolanaTokenDraft(draft: SolanaTokenDraft): string[] {
  const problems: string[] = [];
  const name = draft.name.trim();
  const symbol = draft.symbol.trim();
  const encoder = new TextEncoder();

  if (!name) problems.push('Token name is required');
  else if (encoder.encode(name).length > SOLANA_METADATA_LIMITS.nameMaxLength) {
    problems.push(`Token name must be at most ${SOLANA_METADATA_LIMITS.nameMaxLength} bytes`);
  }

  if (!symbol) problems.push('Ticker is required');
  else if (encoder.encode(symbol).length > SOLANA_METADATA_LIMITS.symbolMaxLength) {
    problems.push(`Ticker must be at most ${SOLANA_METADATA_LIMITS.symbolMaxLength} bytes`);
  } else if (!/^[A-Za-z0-9]+$/.test(symbol)) {
    problems.push('Ticker may only contain letters and numbers');
  }

  if ((draft.description ?? '').length > SOLANA_METADATA_LIMITS.descriptionMaxLength) {
    problems.push(
      `Description must be at most ${SOLANA_METADATA_LIMITS.descriptionMaxLength} characters`,
    );
  }

  const urls: Array<[string, string | undefined]> = [
    ['Image', draft.image],
    ['Website', draft.website],
  ];
  for (const [label, url] of urls) {
    if (url && !/^(https:\/\/|ipfs:\/\/)/.test(url.trim())) {
      problems.push(`${label} must be an https:// or ipfs:// URL`);
    }
  }

  return problems;
}
