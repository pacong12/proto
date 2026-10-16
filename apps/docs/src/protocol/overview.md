# What is Proto?

**Proto** is a community-first, non-custodial crypto launchpad built on **Robinhood Chain (Chain ID: 4663)** and **Arc Network (Chain ID: 5042)**.

It provides an accessible, fair, and safe platform for anyone to create, trade, and discover digital tokens without complex financial barriers, hidden pre-sales, or risk of sudden liquidity drains (_rug pulls_).

---

## Why Proto Exists

In typical crypto launchpads, everyday users face multiple common risks:

1. **Rug Pulls & Vanishing Liquidity**: Creators create a token, wait for retail buyers to enter, then withdraw all pooled money.
   - **Proto's Solution**: Every pool's liquidity position is created and locked permanently inside an open-source smart contract (`LiquidityLocker.sol`) upon launch. No human, creator, or platform administrator can unlock or remove the pooled funds.
2. **Sniper Bot Front-Running**: High-speed automated bots often purchase 50% or more of a token's supply within fractions of a second, then dump on genuine users.
   - **Proto's Solution**: Automated anti-snipe limits cap purchases per transaction and per wallet during the initial launch window, ensuring community members have a fair opportunity to participate.
3. **Hidden Team Allocations**: Projects often quietly reserve large token allocations for insiders.
   - **Proto's Solution**: Fixed total supply of exactly **1,000,000,000 tokens** (1 Billion) minted transparently onchain. No additional tokens can ever be minted.

---

## Launch Architecture by Chain

- **Robinhood Chain**: tokens trade on a bonding curve. About 714.3M tokens (71.43% of supply) are sold on the curve; once 4.2 ETH is raised, anyone can graduate the market into a permanently locked Uniswap v4 pool holding the remaining ~285.7M tokens.
- **Arc Network**: there is no separate curve. The full supply sits as single-sided liquidity in a Uniswap v4 pool from the first block (opening value ≈ $2,480). The token graduates in-pool once its market cap passes ≈ $45,000; nothing migrates and the liquidity stays locked.

---

## What You Need to Get Started

To use Proto, you only need three things:

1. An Ethereum-compatible Web3 wallet (such as MetaMask, Coinbase Wallet, Rabby, or Rainbow).
2. Either Robinhood Chain or Arc Network added to your wallet.
3. A small amount of native gas (ETH on Robinhood or USDC on Arc) to cover transaction fees.

Ready to explore? Continue to [How to Launch a Token](/protocol/launches) or read the [Trading & Swaps Guide](/protocol/trading-guide).
