/**
 * Executes the Solana token launch transaction on LiteSVM (an in-process Solana VM that
 * ships the real SPL Token-2022 and Associated Token Account programs) and prints a JSON
 * report for `solana-token.service.spec.ts`.
 *
 * It runs as a separate Bun process because the LiteSVM native addon crashes the Vitest
 * worker during teardown, even when every assertion passes.
 */
import { FailedTransactionMetadata, LiteSVM } from 'litesvm';
import { Keypair, LAMPORTS_PER_SOL, Transaction, type Connection } from '@solana/web3.js';
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createMintToInstruction,
  getExtensionData,
  getMetadataPointerState,
  unpackAccount,
  unpackMint,
} from '@solana/spl-token';
import { unpack as unpackTokenMetadata } from '@solana/spl-token-metadata';
import {
  buildSolanaTokenLaunchTransaction,
  estimateSolanaNetworkFeeLamports,
} from '../../src/chains/solana/solana-token.service';

function svmConnection(svm: LiteSVM): Connection {
  return {
    getMinimumBalanceForRentExemption: async (size: number) =>
      Number(svm.minimumBalanceForRentExemption(BigInt(size))),
    getLatestBlockhash: async () => ({
      blockhash: svm.latestBlockhash(),
      lastValidBlockHeight: 1000,
    }),
  } as unknown as Connection;
}

function readAccount(svm: LiteSVM, address: Keypair['publicKey']) {
  const account = svm.getAccount(address);
  if (!account) throw new Error(`account ${address.toBase58()} not found`);
  return {
    data: Buffer.from(account.data),
    executable: account.executable,
    lamports: account.lamports,
    owner: TOKEN_2022_PROGRAM_ID,
    rentEpoch: 0,
  };
}

async function launch(
  svm: LiteSVM,
  creator: Keypair,
  overrides: Partial<{ name: string; symbol: string; metadataUri: string }> = {},
) {
  const built = await buildSolanaTokenLaunchTransaction(svmConnection(svm), {
    name: 'Proto Cat',
    symbol: 'PCAT',
    metadataUri: 'https://gateway.pinata.cloud/ipfs/bafybeigdyrztmetadata',
    creator: creator.publicKey,
    ...overrides,
  });
  // Same order as the UI: the wallet signs first, then the generated mint keypair.
  built.transaction.partialSign(creator);
  built.transaction.partialSign(built.mint);
  const result = svm.sendTransaction(built.transaction);
  const failure =
    result instanceof FailedTransactionMetadata
      ? `${result.err().toString()}\n${result.meta().logs().join('\n')}`
      : null;
  return { built, failure };
}

function fundedCreator(svm: LiteSVM) {
  const creator = Keypair.generate();
  svm.airdrop(creator.publicKey, BigInt(2 * LAMPORTS_PER_SOL));
  return creator;
}

async function standardLaunch() {
  const svm = new LiteSVM();
  const creator = fundedCreator(svm);
  const { built, failure } = await launch(svm, creator);
  if (failure) return { failure };

  const mint = unpackMint(
    built.mint.publicKey,
    readAccount(svm, built.mint.publicKey),
    TOKEN_2022_PROGRAM_ID,
  );
  const pointer = getMetadataPointerState(mint);
  const metadata = unpackTokenMetadata(
    getExtensionData(ExtensionType.TokenMetadata, mint.tlvData)!,
  );
  const holding = unpackAccount(
    built.creatorTokenAccount,
    readAccount(svm, built.creatorTokenAccount),
    TOKEN_2022_PROGRAM_ID,
  );

  // Try to mint one more raw unit after launch; it must be rejected.
  const extraMint = new Transaction({
    feePayer: creator.publicKey,
    recentBlockhash: svm.latestBlockhash(),
  }).add(
    createMintToInstruction(
      built.mint.publicKey,
      built.creatorTokenAccount,
      creator.publicKey,
      1n,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
  );
  extraMint.sign(creator);
  const extraMintRejected = svm.sendTransaction(extraMint) instanceof FailedTransactionMetadata;

  return {
    failure: null,
    supply: mint.supply.toString(),
    rawSupply: built.rawSupply.toString(),
    decimals: mint.decimals,
    mintAuthority: mint.mintAuthority?.toBase58() ?? null,
    freezeAuthority: mint.freezeAuthority?.toBase58() ?? null,
    pointerTargetsMint: pointer?.metadataAddress?.equals(built.mint.publicKey) ?? false,
    pointerAuthority: pointer?.authority?.toBase58() ?? null,
    metadata: {
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri,
      updateAuthorityIsCreator: metadata.updateAuthority?.equals(creator.publicKey) ?? false,
    },
    holderIsCreator: holding.owner.equals(creator.publicKey),
    holderAmount: holding.amount.toString(),
    extraMintRejected,
  };
}

async function maxLengthLaunch() {
  const svm = new LiteSVM();
  const creator = fundedCreator(svm);
  const before = svm.getBalance(creator.publicKey) ?? 0n;
  const { built, failure } = await launch(svm, creator, {
    name: 'N'.repeat(32),
    symbol: 'S'.repeat(10),
    metadataUri: `https://example.com/${'u'.repeat(180)}`,
  });
  const after = svm.getBalance(creator.publicKey) ?? 0n;
  return {
    failure,
    transactionBytes: built.transaction.serialize().length,
    spentLamports: Number(before - after),
    rentLamports: built.rentLamports,
    estimatedTotalLamports: built.rentLamports + estimateSolanaNetworkFeeLamports(),
  };
}

async function unfundedLaunch() {
  const svm = new LiteSVM();
  const { failure } = await launch(svm, Keypair.generate());
  return { rejected: failure !== null };
}

const report = {
  standard: await standardLaunch(),
  maxLength: await maxLengthLaunch(),
  unfunded: await unfundedLaunch(),
};
process.stdout.write(JSON.stringify(report));
