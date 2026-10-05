import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  type Connection,
} from '@solana/web3.js';
import {
  AuthorityType,
  ExtensionType,
  LENGTH_SIZE,
  TOKEN_2022_PROGRAM_ID,
  TYPE_SIZE,
  createAssociatedTokenAccountInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  getAssociatedTokenAddressSync,
  getMintLen,
} from '@solana/spl-token';
import { createInitializeInstruction, pack, type TokenMetadata } from '@solana/spl-token-metadata';
import { SOLANA_NETWORK, type SolanaNetworkConfig } from '@proto/shared-types';

/** Solana's hard limit for a serialized transaction. */
export const SOLANA_MAX_TRANSACTION_BYTES = 1232;

/** Rent for a Token-2022 associated token account (165 base bytes + ImmutableOwner extension). */
const ASSOCIATED_ACCOUNT_SIZE = 170;

const DEFAULT_COMPUTE_UNIT_LIMIT = 200_000;
const DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS = 50_000;

export interface SolanaTokenLaunchParams {
  name: string;
  symbol: string;
  /** URI of the off-chain metadata JSON (image, description, socials). */
  metadataUri: string;
  creator: PublicKey;
  /** Priority fee in micro-lamports per compute unit; helps inclusion on a busy mainnet. */
  priorityFeeMicroLamports?: number;
}

export interface SolanaLaunchTransaction {
  transaction: Transaction;
  mint: Keypair;
  creatorTokenAccount: PublicKey;
  /** Raw token amount minted (supply scaled by decimals). */
  rawSupply: bigint;
  /** Lamports locked as rent in the new mint and token accounts. */
  rentLamports: number;
  lastValidBlockHeight: number;
}

/**
 * Build the single atomic transaction that launches a fixed-supply SPL Token-2022 token:
 * create mint, point metadata at the mint itself, initialize the mint without a freeze
 * authority, write name/symbol/uri on-chain, mint the full supply to the creator, and
 * finally revoke the mint authority so the supply can never be increased.
 *
 * The returned transaction is unsigned; it needs both the creator wallet signature and
 * the mint keypair signature before it can be sent.
 */
export async function buildSolanaTokenLaunchTransaction(
  connection: Connection,
  params: SolanaTokenLaunchParams,
  network: SolanaNetworkConfig = SOLANA_NETWORK,
): Promise<SolanaLaunchTransaction> {
  const { decimals, supply, revokeMintAuthority, disableFreezeAuthority } = network.launchConfig;
  const mint = Keypair.generate();
  const creator = params.creator;

  const metadata: TokenMetadata = {
    mint: mint.publicKey,
    updateAuthority: creator,
    name: params.name,
    symbol: params.symbol,
    uri: params.metadataUri,
    additionalMetadata: [],
  };

  // The account is created with room for the mint and pointer extension only; the metadata
  // extension reallocates the account, but the lamports for it must be deposited up front.
  const mintSpace = getMintLen([ExtensionType.MetadataPointer]);
  const metadataSpace = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;

  const [mintRent, accountRent, { blockhash, lastValidBlockHeight }] = await Promise.all([
    connection.getMinimumBalanceForRentExemption(mintSpace + metadataSpace),
    connection.getMinimumBalanceForRentExemption(ASSOCIATED_ACCOUNT_SIZE),
    connection.getLatestBlockhash('confirmed'),
  ]);

  const creatorTokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    creator,
    false,
    TOKEN_2022_PROGRAM_ID,
  );
  const rawSupply = supply * 10n ** BigInt(decimals);

  const transaction = new Transaction({ feePayer: creator, blockhash, lastValidBlockHeight });
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: DEFAULT_COMPUTE_UNIT_LIMIT }),
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: params.priorityFeeMicroLamports ?? DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS,
    }),
    SystemProgram.createAccount({
      fromPubkey: creator,
      newAccountPubkey: mint.publicKey,
      space: mintSpace,
      lamports: mintRent,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    // Pointer authority is null: the metadata location is permanently the mint itself.
    createInitializeMetadataPointerInstruction(
      mint.publicKey,
      null,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeMintInstruction(
      mint.publicKey,
      decimals,
      creator,
      disableFreezeAuthority ? null : creator,
      TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      metadata: mint.publicKey,
      updateAuthority: creator,
      mint: mint.publicKey,
      mintAuthority: creator,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri,
    }),
    createAssociatedTokenAccountInstruction(
      creator,
      creatorTokenAccount,
      creator,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID,
    ),
    createMintToInstruction(
      mint.publicKey,
      creatorTokenAccount,
      creator,
      rawSupply,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
  );

  if (revokeMintAuthority) {
    transaction.add(
      createSetAuthorityInstruction(
        mint.publicKey,
        creator,
        AuthorityType.MintTokens,
        null,
        [],
        TOKEN_2022_PROGRAM_ID,
      ),
    );
  }

  return {
    transaction,
    mint,
    creatorTokenAccount,
    rawSupply,
    rentLamports: mintRent + accountRent,
    lastValidBlockHeight,
  };
}

/** Network fee estimate: base signature fees plus the configured priority fee. */
export function estimateSolanaNetworkFeeLamports(
  priorityFeeMicroLamports = DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS,
  signatures = 2,
): number {
  const baseFee = 5000 * signatures;
  const priorityFee = Math.ceil(
    (priorityFeeMicroLamports * DEFAULT_COMPUTE_UNIT_LIMIT) / 1_000_000,
  );
  return baseFee + priorityFee;
}

export { PublicKey };
