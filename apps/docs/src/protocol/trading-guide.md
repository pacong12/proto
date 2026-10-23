# Trading & Swaps Guide

Buying and selling tokens on Goton is designed to be fast, responsive, and safe. Every trade is executed non-custodially through your personal wallet.

---

## How to Buy Tokens

1. **Select a Token**: Browse the **Explore** page or click any token card to open its dedicated Trade View.
2. **Review the Chart & Metrics**:
   - View live price candles and 24-hour volume trends.
   - Check whether the token is currently **On Curve** (climbing toward graduation) or **Graduated** (trading on Uniswap DEX).
   - Review community metrics, top holders, and creator status badges.
3. **Choose Buy Mode**: In the trade panel on the right, ensure the **Buy** tab is active.
4. **Enter Amount**:
   - Type the amount you want to spend (ETH on Robinhood Chain, USDC on Arc), or use the quick-select buttons. You can also enter the amount in USD.
   - The panel automatically calculates your estimated tokens received.
5. **Adjust Slippage (Optional)**:
   - Click the settings gear icon to configure your slippage tolerance (presets 0.5%, 1%, 2.5% and 5%, a custom value, or Auto).
   - Slippage tolerance ensures your order automatically cancels if the price moves against you beyond your chosen threshold.
6. **Confirm Swap**: Click **Buy [Token Symbol]** and sign the transaction in your wallet.

---

## How to Sell Tokens

1. Open the trade view for the token you hold.
2. Select the **Sell** tab in the trade panel.
3. Enter the quantity of tokens you wish to sell, or use percentage shortcuts (`25%`, `50%`, `75%`, `100% / Max`).
4. Review the estimated ETH payout you will receive.
5. Click **Sell [Token Symbol]**:
   - First time selling? Your wallet will prompt an initial one-click approval to permit the smart contract to process your tokens.
   - Confirm the sell transaction to receive ETH directly into your wallet.

---

## Understanding Price Impact & Slippage

- **Price Impact**: In decentralized trading, purchasing a large percentage of available tokens will shift the price upward. For bonding curve tokens, the price changes predictably along the curve formula ($x \cdot y = k$).
- **Slippage**: Protects you from front-running. If other trades occur between the time you click "Buy" and the block confirmation, your trade is guaranteed to receive at least your minimum expected tokens, or it will safely cancel without spending your funds.

---

## Reading a Token Page

- **Market cap** is the token's total value now: price × total supply (1 billion). It moves with the price even when nobody trades.
- **24h volume** is the value of every buy and sell in the last 24 hours. A token can have a high market cap and no volume: valuable, but quiet.
- **24h change** compares the price with 24 hours ago. A token that has not traded in that window shows 0%.
- **Buy / sell pressure** splits recent volume into buys and sells over 5 minutes, 1 hour, 6 hours or 24 hours.
- **Holders** lists the largest balances. The bonding curve (or the pool after graduation) is labelled as such, not shown as a user.
- **Top traders** lists each wallet's buys, sells, current holding and profit.
- The **chart** shows price or market cap in candles from 1 second to 1 day. Bars without trades are drawn in grey.
- On Explore, the small **graph** next to each token is its price from launch to now.

---

## Limit, Take-Profit & Stop-Loss

To buy or sell at a target instead of the live price, use the **Limit** and **TP / SL** tabs in the trade panel. See [Limit, Take-Profit & Stop-Loss Orders](/protocol/advanced-orders).
