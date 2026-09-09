# Protocol Overview

**Proto** is an institutional-grade, non-custodial token launchpad and trading protocol deployed on **Robinhood Chain (Chain ID: 4663)**.

Proto provides dual launch options:

- **v1 (Direct Launch)**: Launches directly into permanently locked **Uniswap V3** liquidity pools quoted in WETH.
- **v2 (Bonding Curve)**: Launches via mathematical constant-product bonding curve, then graduates into **Uniswap v4** singleton pools governed by the protocol's Meme Hook upon raising 4.2 ETH.

## Core Philosophy

Traditional token launchpads (e.g. bonding curves) suffer from multiple systemic flaws:

- **Migration Exploits**: Fragile transition steps from bonding curve to DEX that invite MEV sandwich attacks.
- **Stuck Liquidity**: Failed migration transactions that lock user funds indefinitely.
- **Fragmented Liquidity**: Artificial pricing formulas disconnected from the broader DeFi ecosystem.

Proto eliminates migration entirely:

1. Every token launches directly into its own Uniswap V3 WETH pool.
2. 100% of non-creator token supply is provided as liquidity at block 0.
3. Liquidity positions are permanently locked into `LiquidityLocker`.
4. Trading occurs in the same pool from launch through graduation and beyond.

---

## Protocol Specifications: v1 vs v2

| Metric                    | v1 (Uniswap V3 Direct)                           | v2 (Bonding Curve to Uniswap v4)                    |
| :------------------------ | :----------------------------------------------- | :-------------------------------------------------- |
| **Total Token Supply**    | Fixed **1,000,000,000** (18 decimals)            | Fixed **1,000,000,000** (18 decimals)               |
| **Exchange / DEX**        | **Uniswap V3** (Direct Pool + NFT Locker)        | **Uniswap v4** (Singleton PoolManager + Meme Hook)  |
| **Curve Allocation**      | N/A (100% in locked V3 pool)                     | 80% on curve, 20% reserved for v4 graduation pool   |
| **Graduation Target**     | **4.2 ETH** paired in pool                       | **4.2 ETH** raised on curve                         |
| **Creation Fee**          | **0.0005 ETH**                                   | **0.0005 ETH**                                      |
| **Trading Fee Split**     | **70% Creator / 30% Protocol**                   | **70% Creator / 30% Protocol** (handled by v4 Hook) |
| **Anti-Snipe**            | 2-block max buy & wallet hold limits             | Decaying 99% tax over 5 seconds                     |
| **Protocol Revenue Burn** | **80% of protocol fees** burned via TWAP buyback | **80% of protocol fees** burned via TWAP buyback    |
