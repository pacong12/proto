# Proto - Decentralized Fixed-Supply Launchpad Protocol

Proto is an institutional-grade, non-custodial token launchpad and trading protocol built on **Robinhood Chain** (Chain ID: 4663).

## Features
- **Atomic 1-Tx Launch**: Deploys fixed-supply token (1 Billion supply) and Uniswap V3 liquidity pool in a single transaction.
- **Permanent Liquidity Lock**: Positions are locked directly into the LiquidityLocker contract on creation.
- **2-Block Anti-Snipe Window**: Max wallet (5%) and max buy (5.5%) restrictions for the first 2 blocks post-launch.
- **Creator & Protocol Fee Split**: Trading fees (WETH + Token) are accrued in the locker and split (70% Creator / 30% Protocol) with automated holder distribution support.
- **Self-Describing Onchain Metadata**: All token metadata (`name`, `symbol`, `logo`, `description`, `socials`, `liquidityPool`) lives directly onchain.

## Directory Structure
```text
proto/
├── contracts/             # Solidity & Foundry smart contract suite
├── packages/
│   └── shared-types/      # Domain entities, Intent schemas, ApiEnvelope
├── apps/
│   ├── api/               # NestJS backend (Clean Architecture)
│   └── frontoffice/       # Vue 3 / Vite frontend
├── docs/                  # Architectural specs, ADRs, and guides
└── scripts/               # Herdr agent coordination & IRC scripts
```

## Getting Started
```bash
npm install
npm run ci
```
