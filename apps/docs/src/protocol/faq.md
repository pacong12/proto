# Frequently Asked Questions (FAQ)

Find answers to common questions about trading, launching, and managing tokens on Goton.

---

## General Questions

### What is Goton?

Goton is a decentralized, non-custodial crypto launchpad supporting both **Robinhood Chain** (L2) and **Arc Network** (Circle Stablecoin L1). It allows anyone to launch fixed-supply tokens, trade with live charts, and participate in fair launches with permanently locked liquidity.

### Can a developer rug pull or drain liquidity?

**No.** Liquidity pool positions created on Goton are minted directly into the open-source `LiquidityLocker.sol` smart contract and permanently locked forever. There is no unlock function, backdoor, or admin withdrawal key.

### What wallets are supported?

Goton supports all standard Ethereum-compatible Web3 wallets, including:

- MetaMask
- Coinbase Wallet
- Rabby Wallet
- Rainbow Wallet
- WalletConnect / Reown compatible mobile wallets

Goton connects wallets only. There is no email or social login, so the app never holds a key for you.

---

## Trading & Swaps

### Why did my trade fail?

Trades usually fail for two reasons:

1. **Slippage Exceeded**: During high volatility, the price changed more than your configured slippage percentage between the time you clicked and block confirmation. Increase slippage in trade settings (e.g. from 1% to 2%).
2. **Insufficient Gas Balance**: Always keep a small balance of native gas token (ETH on Robinhood or USDC on Arc) to pay for network execution fees.

### What is the difference between On Curve and Graduated?

- **On Curve (v2)**: The token is currently trading on the mathematical bonding curve. Price increases as tokens are bought.
- **Graduated**: On Robinhood Chain, the curve raised its 4.2 ETH target and the market moved permanently into a locked Uniswap v4 pool. On Arc Network, tokens trade in a Uniswap v4 pool from launch and graduate in-pool once the market cap passes about $45,000.

### Can I buy or sell at a target price?

Yes. The **Limit** and **TP / SL** tabs place an order that fills automatically when the market cap reaches your target, and you can cancel it at any time. See [Limit, Take-Profit & Stop-Loss Orders](/protocol/advanced-orders).

### What is the difference between Explore and Memestock?

Explore lists every token. Memestock lists only launches with a written thesis whose creator bought and still holds most of their position, ranked by recent trading. See [Feed, Calls, Memestock & Following](/protocol/social).

### Are there any selling restrictions?

**Never.** Users can sell their tokens at any time. Goton never imposes lockups, selling cooldowns, or transfer freezes on holders.

---

## Token Creation

### How much does it cost to launch a token?

The protocol deployment fee is **0.0005 ETH** on Robinhood Chain or **Free (0 USDC)** on Arc Network (requires minimum 4.50 USDC initial pre-buy). This covers smart contract deployment, token minting, and initial liquidity locking.

### Can more tokens be minted later?

**No.** Every token created on Goton has an immutable, fixed supply of exactly **1,000,000,000 tokens** (1 Billion). The contract has no mint function.

### How do creators earn fees?

Each token's fees and tax are split on-chain: **70% to the creator's share on Robinhood Chain, 80% on Arc**, and the rest to the protocol. The creator can divide that share once, before public trading starts, between themselves, holders and buyback-and-burn. See [Creator Fees & Rewards](/protocol/fees-and-burns). Claim accrued fees on your **Profile** page.

---

## Network & Support

### What network does Goton use?

Goton operates as a multi-chain protocol supporting **Robinhood Chain** (Chain ID: `4663`) and **Arc Network** (Chain ID: `5042`).

### Where can I get help?

For community assistance, discussions, and updates, join our official community channels or review our [Verified Smart Contracts](/integration/contracts).
