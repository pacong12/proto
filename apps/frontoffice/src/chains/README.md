# Frontoffice Multi-Chain Architecture

## 1. Overview

The Frontoffice client uses the **Strategy Pattern** to route token launches, curve trades, and post-graduation
swaps to the right implementation without hardcoding chain IDs. Strategies exist per **launch model**, not per
chain: every network in `CHAINS` (`@goton/shared-types`) gets the adapter of its model (`getLaunchModel` in
`@goton/math-sdk`), constructed with its own `NetworkConfig`.

```
                     CHAINS (shared-types) + getLaunchModel (math-sdk)
                                       │
                         ┌─────────────┴─────────────┐
                         ▼                           ▼
            ┌──────────────────────────┐ ┌──────────────────────────┐
            │ BondingCurveChainAdapter │ │ InPoolV4ChainAdapter     │
            │ model: bonding-curve     │ │ model: v4-in-pool        │
            │ curve → v4 graduation    │ │ launch straight into v4  │
            │ e.g. Robinhood Chain     │ │ e.g. Arc Network         │
            └──────────────────────────┘ └──────────────────────────┘
```

---

## 2. Directory Structure

```
apps/frontoffice/src/chains/
├── types.ts                               # ChainAdapter interface, launch/swap params
├── index.ts                               # One adapter per registered chain, by launch model
├── bonding-curve/bonding-curve.adapter.ts # Bonding curve, then permissionless v4 graduation
├── v4-in-pool/v4-in-pool.adapter.ts       # In-pool Uniswap v4 launches
└── shared/                                # Curve and v4 router swaps, helpers
```

---

## 3. Adding a New Chain

1. Register the network in `packages/shared-types`, `math-sdk` and `contracts-abi` (see `docs/CHAINS.md`).
2. That is all for a chain on an existing launch model: `getChainAdapter`, the viem clients and the AppKit
   networks are built from `CHAINS`.
3. A new launch model needs a `ChainAdapter` in `src/chains/<model>/`, added to `ADAPTER_FOR_MODEL` in
   `index.ts`.
