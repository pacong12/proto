# Multi-Chain Architectural Specification

## Overview

The Proto protocol is designed from the ground up for multi-chain scalability.
Rather than hardcoding conditional branches (`if (chainId === 5042)`), the codebase uses dedicated chain modules across all architectural layers.

---

## 1. Comparative Matrix

| Feature                     | Robinhood Chain                              | Arc Network                                  |
| :-------------------------- | :------------------------------------------- | :------------------------------------------- |
| **Chain ID**                | `4663`                                       | `5042`                                       |
| **Network Type**            | Arbitrum Nitro L2                            | Circle Stablecoin L1                         |
| **Native Gas Currency**     | ETH (18 decimals)                            | USDC (18 decimals in `msg.value`)            |
| **Token Total Supply**      | 1,000,000,000                                | 1,000,000,000                                |
| **Curve Token Allocation**  | 714,285,714 (71.43%)                         | 100% in v4 pool (~765.4M sold by graduation) |
| **DEX Pool Allocation**     | 285,714,286 (28.57%)                         | 100% from launch (single-sided)              |
| **Initial Virtual Reserve** | 1.68 ETH                                     | 2,480.74 USDC (tick 405400)                  |
| **Graduation Target**       | 4.20 ETH                                     | ≈ $45,079 market cap (tick 376400)           |
| **Launch Fee**              | 0.0005 ETH                                   | 0 (mandatory 4.50 USDC prebuy)               |
| **Graduation DEX Model**    | BondingCurve → trustless Uniswap V4 pool     | In-pool Uniswap V4, no migration (Argus)     |
| **Fee Recipient / Owner**   | `0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2` | `0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2` |

---

## 2. Cross-Package File Organization

| Architectural Layer        | Robinhood Chain Module                           | Arc Network Module                         |
| :------------------------- | :----------------------------------------------- | :----------------------------------------- |
| **Smart Contracts**        | `contracts/src/chains/robinhood/`                | `contracts/src/chains/arc/`                |
| **Contract Documentation** | `contracts/src/chains/robinhood/README.md`       | `contracts/src/chains/arc/README.md`       |
| **Deployment Scripts**     | `contracts/script/robinhood/`                    | `contracts/script/arc/`                    |
| **Test Suites**            | `contracts/test/robinhood/`                      | `contracts/test/arc/`                      |
| **Domain Definitions**     | `packages/shared-types/src/chains/robinhood.ts`  | `packages/shared-types/src/chains/arc.ts`  |
| **Math SDK**               | `packages/math-sdk/src/chains/robinhood.ts`      | `packages/math-sdk/src/chains/arc.ts`      |
| **Contract ABIs**          | `packages/contracts-abi/src/chains/robinhood.ts` | `packages/contracts-abi/src/chains/arc.ts` |
| **Backend API**            | `apps/api/src/modules/chains/robinhood/`         | `apps/api/src/modules/chains/arc/`         |
| **Frontend Adapters**      | `apps/frontoffice/src/chains/robinhood/`         | `apps/frontoffice/src/chains/arc/`         |

Chain-agnostic contracts used by every chain live in `contracts/src/core/`: `LaunchpadToken`, `BondingCurve`,
`GotonV4Hook` (singleton v4 hook with TWAP oracle), `GotonFeeSplitter` (per-token fees and streamed dividends),
`GotonV4Graduator` (trustless curve → v4 graduation), `GotonV4Router` (swaps), `GotonV4Buyback` (TWAP-guarded
buyback-and-burn), `VestingVault`, plus `src/libraries/`
(incl. `v4/TickMath`, `v4/V4Lib`) and `src/interfaces/`. Superseded contracts (V1 factory, V3 `LiquidityLocker` / `BuybackBurner` path,
`HolderFeeDistributor`, `ProtoLiquidityLockerV4`, `ProtoMemeHook`) live in `contracts/src/legacy/`.

### Adding a New Chain

Use the chain slug (lowercase, e.g. `base`) consistently for every folder and file name.

1. **Contracts** — reuse `src/core/` (hook, splitter, router, and the graduator for bonding-curve chains); only the
   factory / chain-specific pieces go in `contracts/src/chains/<slug>/`. Mine the hook address with
   `script/lib/HookMiner.sol`. Add `script/<slug>/Deploy<Name>.s.sol`, `test/<slug>/`, a `README.md`, and an `[etherscan]` entry in
   `contracts/foundry.toml`.
2. **ABIs** — add the new contracts to `packages/contracts-abi/scripts/export-foundry-abis.ts`, run `bun run export-abis`,
   create `packages/contracts-abi/src/chains/<slug>.ts` exporting a `ChainAbis`, and append it to `CHAIN_ABIS` in
   `src/chains/registry.ts`.
3. **Math** — create `packages/math-sdk/src/chains/<slug>.ts` exporting a `ChainMathConfig` and append it to
   `CHAIN_MATH_CONFIGS` in `src/chains/registry.ts`.
4. **Network** — create `packages/shared-types/src/chains/<slug>.ts` exporting `<SLUG>_CHAIN_ID` and a `NetworkConfig`
   (with `slug`, env-overridable addresses, and `knownAddresses` for legacy deployments), then append it to `CHAINS`
   and `SupportedChainId` in `src/chains/registry.ts`.
5. **Verify** — `packages/shared-types/test/chain-registry.spec.ts` fails if the chain is missing from any registry or
   its math parameters disagree with its `NetworkConfig`.
6. **Apps** — add the API chain service (`apps/api/src/modules/chains/<slug>/`) and frontend adapter
   (`apps/frontoffice/src/chains/<slug>/`).

Resolvers (`resolveTokenNetwork`, `resolveNetworkByParam`, `getFactoryV2Abi`, `getChainMathConfig`) iterate the
registries, so they pick up the new chain without code changes.

---

## 3. Sovereign Protocol vs Third-Party Infrastructure

Proto adopts **Sovereign Infrastructure (Opsi 2)**:

- Robinhood Chain graduates into Uniswap V4 using Proto's sovereign `ProtoLiquidityLockerV4` (`0x7A1A...`) and `ProtoMemeHook` (`0x6347...`) with `LaunchpadV2Factory` (`0x9f1f...`).
- Arc Network launches directly into Uniswap V4 (Argus portal model): the factory-owned launch position is locked forever, `ProtoMemeHookArc` charges fixed USDC taxes and tracks in-place graduation, and per-token `ArcFeeSplitter`s pay holders in USDC. Proto does not use Uniswap V3 on Arc.
- Protocol fees, locker fees, and trading incentives flow directly to Proto (`0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2`) and token creators without dependency on third-party multisigs (e.g. Pons Multisig `0x263ed...`).
