# Architecture Decision Record: Uniswap V3 Direct Pool Launchpad

## Status
Accepted

## Context
Traditional token launchpads (e.g., pump.fun style bonding curves) require complex off-chain or on-chain migration phases when the curve finishes, leading to MEV vulnerability, stuck liquidity, and downtime during pool migration.

## Decision
Proto implements direct Uniswap V3 pool deployment on Robinhood Chain:
1. Token and V3 pair are created in the same atomic transaction.
2. 100% of non-creator supply is placed into the Uniswap V3 pool with a 1% fee tier (`10000`).
3. Position NFT is permanently transferred to `LiquidityLocker`.
4. Trading occurs in the same pool from block 0 through graduation and beyond.

## Consequences
- **Positive**: Zero migration risk, immediate deep liquidity, native concentrated liquidity fee generation.
- **Mitigation**: 2-block anti-snipe restrictions prevent sniper bots from sweeping the entire pool at initialization.
