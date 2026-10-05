/**
 * Dependency-free launch cost estimate for display before the Solana libraries load.
 * Mirrors the account sizes used by `buildSolanaTokenLaunchTransaction`.
 */

/** Rent-exempt minimum = (data length + 128 byte account overhead) * 6960 lamports per byte. */
const LAMPORTS_PER_BYTE = 6960;
const ACCOUNT_OVERHEAD_BYTES = 128;

/** Token-2022 mint with the MetadataPointer extension (getMintLen([MetadataPointer])). */
const MINT_WITH_POINTER_BYTES = 234;
/** Token-2022 associated token account with the ImmutableOwner extension. */
const TOKEN_ACCOUNT_BYTES = 170;
/** TLV header (type + length) plus update authority, mint and four u32 length prefixes. */
const METADATA_FIXED_BYTES = 4 + 32 + 32 + 4 * 4;

const NETWORK_FEE_LAMPORTS = 2 * 5000 + 10_000;

function rent(bytes: number): number {
  return (bytes + ACCOUNT_OVERHEAD_BYTES) * LAMPORTS_PER_BYTE;
}

export function estimateSolanaLaunchCostLamports(
  name: string,
  symbol: string,
  metadataUriLength = 90,
): number {
  const encoder = new TextEncoder();
  const metadataBytes =
    METADATA_FIXED_BYTES +
    encoder.encode(name.trim()).length +
    encoder.encode(symbol.trim()).length +
    metadataUriLength;
  return (
    rent(MINT_WITH_POINTER_BYTES + metadataBytes) + rent(TOKEN_ACCOUNT_BYTES) + NETWORK_FEE_LAMPORTS
  );
}
