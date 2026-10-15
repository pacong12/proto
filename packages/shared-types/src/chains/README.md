# Domain Chain Specifications & Resolvers

## 1. Overview

This package defines the single source of truth for supported blockchain networks in the Proto protocol.
It decouples chain-specific logic and eliminates magic chain IDs across all applications and smart contracts.

---

## 2. Supported Networks Comparison

| Dimension             | Robinhood Chain (`robinhood.ts`) | Arc Network (`arc.ts`)      |
| :-------------------- | :------------------------------- | :-------------------------- |
| **Chain ID**          | `4663`                           | `5042`                      |
| **Native Asset**      | Ether (ETH)                      | USD Coin (USDC)             |
| **Native Decimals**   | 18                               | 18 (in `msg.value`)         |
| **Curve Supply**      | 714,285,714 tokens (71.43%)      | 738,600,000 tokens (73.86%) |
| **Pool Supply**       | 285,714,286 tokens (28.57%)      | 261,400,000 tokens (26.14%) |
| **Virtual Reserve**   | 1.68 ETH                         | 24,420 USDC                 |
| **Graduation Target** | 4.20 ETH                         | 69,000 USDC                 |
| **Launch Fee**        | 0.0005 ETH                       | 1.00 USDC                   |
| **DEX Router**        | Uniswap V3 SwapRouter            | Uniswap V3 SwapRouter       |
| **DEX Position NFT**  | Uniswap V3 PositionManager       | Uniswap V3 PositionManager  |

---

## 3. Dynamic Resolvers (`resolver.ts`)

- `resolveTokenNetwork(token, activeChainId)`: Determines network config based on token attributes (`pairedToken`, `chain_id`), falling back to the user's active wallet network.
- `resolveNetworkByParam(param)`: Resolves network config from route parameter (`?chain=4663`, `?chain=arc`, `?network=robinhood`).
