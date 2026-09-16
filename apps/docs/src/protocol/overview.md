# What is Proto?

**Proto** is a community-first, non-custodial crypto launchpad built on **Robinhood Chain (Chain ID: 4663)** and **Arc Network (Chain ID: 5042002)**.

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

## Two Simple Launch Models

Depending on your project's goals, Proto lets you choose between two launch models:

| Model                | How It Works                                                                                                                                                                                                                 | Ideal For                                                                                |
| :------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| **v1 Direct Pool**   | Launches instantly into an active Uniswap V3 liquidity pool with 100% of non-creator supply locked on day one.                                                                                                               | Projects wanting immediate full DEX depth from the very first block.                     |
| **v2 Bonding Curve** | Starts on a dynamic price curve. 800M tokens are sold gradually as buyers enter. Once the graduation target (4.2 ETH on Robinhood or 8,400 USDC on Arc) is raised, the market automatically graduates to full DEX liquidity. | Community projects, meme tokens, and social experiments wanting gradual price discovery. |

---

## What You Need to Get Started

To use Proto, you only need three things:

1. An Ethereum-compatible Web3 wallet (such as MetaMask, Coinbase Wallet, Rabby, or Rainbow).
2. Either Robinhood Chain or Arc Network added to your wallet.
3. A small amount of native gas (ETH on Robinhood or USDC on Arc) to cover transaction fees.

Ready to explore? Continue to [How to Launch a Token](/protocol/launches) or read the [Trading & Swaps Guide](/protocol/trading-guide).
