# Goton Protocol Goals & Technical Requirements

> **Historical.** Written for the earlier Uniswap V3 locker design; its 70/30 fee split is superseded. Creators now keep 70% (Robinhood Chain) or 80% (Arc) of each token's fees and tax: see [Fees & burns](../apps/docs/src/protocol/fees-and-burns.md).

## 1. High-Level Vision

Goton is a decentralized, non-custodial token launchpad and trading platform deployed on Robinhood Chain (Chain ID: 4663). The protocol simplifies token creation and trading by eliminating artificial bonding curves and deploying directly into permanently locked Uniswap V3 liquidity positions.

## 2. Key Objectives

1. **Atomic Token Deployment**: Minting, pair creation, liquidity provision, and permanent lock must execute in a single atomic transaction.
2. **Anti-Snipe Protection**: Protect initial retail buyers by enforcing maximum wallet and maximum purchase limits for the first two blocks post-launch.
3. **Transparent Fee Distribution**: Accrue Uniswap V3 trading fees (WETH and Token) directly in the locker contract and split 70% to the creator and 30% to the protocol.
4. **Self-Describing Onchain Metadata**: All essential metadata (logo URI, description, website, and social links) must be readable directly from the token smart contract.
5. **Fail-Closed Security**: All backend transaction operations must be formulated as `TransactionIntent` objects and evaluated through strict security policies before signature generation.

## 3. System Requirements

- **Solidity Version**: `^0.8.24` with Foundry framework.
- **Node.js Environment**: `>=20.0.0` with strict TypeScript.
- **Code Quality**: Zero ESLint warnings, 100% type coverage, comprehensive unit and integration tests.
