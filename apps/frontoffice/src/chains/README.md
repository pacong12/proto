# Frontoffice Multi-Chain Architecture

## 1. Overview

The Frontoffice client uses the **Strategy Pattern** to dynamically route token launches, curve trades, and post-graduation swaps to the correct blockchain adapter without hardcoding chain IDs or binary conditionals.

```
                      ┌──────────────────────┐
                      │  ChainRegistry       │
                      │  (getChainAdapter)   │
                      └──────────┬───────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
     ┌──────────────────────┐        ┌──────────────────────┐
     │ Robinhood Adapter    │        │ Arc Adapter          │
     │ (Chain ID: 4663)     │        │ (Chain ID: 5042)     │
     │                      │        │                      │
     │ - Native: ETH (18d)  │        │ - Native: USDC (18d) │
     │ - Curve: 4.2 ETH     │        │ - Curve: 69k USDC    │
     │ - DEX: Uniswap V3    │        │ - DEX: Uniswap V3    │
     └──────────────────────┘        └──────────────────────┘
```

---

## 2. Directory Structure

```
apps/frontoffice/src/chains/
├── types.ts                     # ChainAdapter interface, launch/swap params
├── index.ts                     # Registry & dynamic resolution helpers
├── robinhood/
│   ├── robinhood.adapter.ts     # Robinhood Chain (4663) adapter implementation
│   └── index.ts
└── arc/
    ├── arc.adapter.ts           # Arc Network (5042) adapter implementation
    └── index.ts
```

---

## 3. Adding a New Chain

To support a new blockchain in Proto:

1. Define network parameters in `packages/shared-types/src/chains/<network>.ts`.
2. Implement the `ChainAdapter` interface in `apps/frontoffice/src/chains/<network>/<network>.adapter.ts`.
3. Register the adapter with `registerChainAdapter(newAdapter)`.
4. The rest of the frontend (swap panel, trade view, create token, explorer) will adapt automatically without any component-level code changes.
