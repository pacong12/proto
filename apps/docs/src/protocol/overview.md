# Protocol Overview

**Proto** is an institutional-grade, non-custodial token launchpad and trading protocol deployed on **Robinhood Chain (Chain ID: 4663)**.

Proto provides a seamless token creation and trading experience by replacing artificial bonding curves with **Direct Uniswap V3 Liquidity Pools**.

---

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

## Key Protocol Facts

| Metric                    | Specification                                           |
| :------------------------ | :------------------------------------------------------ |
| **Total Token Supply**    | Fixed at **1,000,000,000** (1 Billion, 18 decimals)     |
| **Pool Quote Asset**      | **WETH** (`0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`) |
| **Uniswap V3 Fee Tier**   | **1% (`10000`)**                                        |
| **Creation Fee**          | **0.0005 ETH**                                          |
| **Graduation Threshold**  | **4.2 ETH** paired in pool                              |
| **Trading Fee Split**     | **70% Creator / 30% Protocol**                          |
| **Protocol Revenue Burn** | **80% of protocol fees** burned via TWAP buyback        |
