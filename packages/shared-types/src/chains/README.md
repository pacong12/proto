# Domain Chain Specifications & Resolvers

## 1. Overview

This package defines the single source of truth for supported blockchain networks in the Goton protocol.
It decouples chain-specific logic and eliminates magic chain IDs across all applications and smart contracts.

---

## 2. Supported Networks Comparison

| Dimension             | Robinhood Chain (`robinhood.ts`) | Arc Network (`arc.ts`)                          |
| :-------------------- | :------------------------------- | :---------------------------------------------- |
| **Chain ID**          | `4663`                           | `5042`                                          |
| **Native Asset**      | Ether (ETH)                      | USD Coin (USDC)                                 |
| **Native Decimals**   | 18                               | 18 (in `msg.value`)                             |
| **Curve Supply**      | 714,285,714 tokens (71.43%)      | 100% in pool; ~765.4M sold by graduation        |
| **Virtual Reserve**   | 1.68 ETH                         | 2,480.74 USDC (tick 405400)                     |
| **Graduation Target** | 4.20 ETH                         | ~8,094 USDC bought (≈ $45,079 FDV, tick 376400) |
| **Launch Fee**        | 0.0005 ETH                       | 0 (mandatory 4.50 USDC prebuy)                  |
| **Launch Model**      | BondingCurve → migration         | In-pool Uniswap v4 (Argus)                      |
| **DEX Router**        | Uniswap V3 SwapRouter            | Uniswap v4 Universal Router                     |

---

## 3. Registry (`registry.ts`)

`CHAINS` is the single list of supported networks (first entry = `DEFAULT_NETWORK`). `SUPPORTED_CHAINS`,
`getNetworkConfig` and all resolvers are derived from it. To add a chain, follow the checklist in `docs/CHAINS.md`.

---

## 4. Dynamic Resolvers (`resolver.ts`)

- `resolveTokenNetwork(token, activeChainId)`: Determines network config based on token attributes (`pairedToken`, `chain_id`), falling back to the user's active wallet network.
- `resolveNetworkByParam(param)`: Resolves network config from route parameter by chain ID, `slug`, name, native symbol or `aliases` (`?chain=4663`, `?chain=arc`, `?network=robinhood`).
