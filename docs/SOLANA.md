# Solana Token Launch

The Create page has a **Solana** tab (`/launchpad/create?chain=solana`) that launches a
fixed-supply SPL token directly from the user's Solana wallet. It is non-custodial and needs
no Proto program on Solana: everything runs through the official SPL Token-2022 and
Associated Token Account programs.

## What one launch transaction does

All steps are in a single atomic transaction, so a launch either fully succeeds or leaves
nothing behind.

1. Create the mint account (Token-2022) funded for rent, including the metadata.
2. Initialize the **MetadataPointer** extension pointing at the mint itself, with no pointer
   authority (the metadata location can never be changed).
3. Initialize the mint with 9 decimals, the creator as temporary mint authority and **no
   freeze authority** (holder accounts can never be frozen).
4. Write `name`, `symbol` and `uri` on-chain with the **TokenMetadata** extension.
5. Create the creator's associated token account and mint the full supply
   (1,000,000,000 tokens) into it.
6. **Revoke the mint authority**, so the supply is fixed forever.

The off-chain metadata JSON referenced by `uri` (image, description, socials) is pinned to
IPFS through `POST /api/ipfs/metadata`, which validates the payload and keeps only known
fields.

The metadata update authority stays with the creator so a broken logo or link can be fixed
later; it cannot change supply or holder balances.

## Cost

The creator pays account rent (about 0.0059 SOL, depending on name and symbol length) plus
network fees, including a small priority fee for reliable inclusion on mainnet. The UI shows
an estimate and the flow refuses to ask for a signature when the wallet balance is too low.

## Wallets

Injected Phantom, Solflare, Backpack, OKX Wallet and Bitget Wallet providers are supported.
The Solana connection is intentionally separate from the EVM AppKit / wagmi wallet store,
which assumes `0x` addresses and EIP-1193 providers throughout.

## Configuration

| Variable                                                       | Default                    | Notes                                                                                                 |
| -------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `SOLANA_CLUSTER` / `VITE_SOLANA_CLUSTER`                       | `mainnet-beta`             | `devnet` or `testnet` for testing                                                                     |
| `SOLANA_RPC_URL` / `VITE_SOLANA_RPC_URL`                       | public RPC for the cluster | Use a dedicated RPC provider in production; the public endpoint rate-limits browsers                  |
| `SOLANA_BLOCK_EXPLORER_URL` / `VITE_SOLANA_BLOCK_EXPLORER_URL` | `https://solscan.io`       |                                                                                                       |
| `PINATA_JWT`                                                   | empty                      | Required for metadata to be actually pinned; without it the API returns an unpinned deterministic CID |

## Code map

| Area                                             | Location                                                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Network config, address validation, input limits | `packages/shared-types/src/chains/solana.ts`                                                                              |
| Metadata upload endpoint                         | `apps/api/src/modules/ipfs/ipfs.controller.ts` (`handleMetadataUpload`)                                                   |
| Transaction builder                              | `apps/frontoffice/src/chains/solana/solana-token.service.ts`                                                              |
| Wallet bridge and composables                    | `apps/frontoffice/src/chains/solana/solana-wallet.ts`, `composables/useSolanaWallet.ts`, `composables/useSolanaLaunch.ts` |
| UI                                               | `apps/frontoffice/src/components/SolanaLaunchView.vue`, `pages/CreatePage.vue`                                            |

## Tests

`apps/frontoffice/test/solana-token.service.spec.ts` executes the real launch transaction on
[LiteSVM](https://github.com/LiteSVM/litesvm), an in-process Solana VM that ships the actual
Token-2022 program, and asserts the resulting on-chain state: supply, revoked mint authority,
missing freeze authority, metadata, holder balance, rejected extra mint and rent cost. The
scenarios run in a separate Bun process because the LiteSVM native addon crashes the Vitest
worker on teardown.

## Not included yet

- Solana tokens are not indexed by the API, so they do not appear in Explore or token pages.
- No Solana bonding curve or liquidity pool; trading requires listing on a Solana DEX.
