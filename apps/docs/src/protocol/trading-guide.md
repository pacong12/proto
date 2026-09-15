# Trading & Swaps Guide

Buying and selling tokens on Proto is designed to be fast, responsive, and safe. Every trade is executed non-custodially through your personal wallet.

---

## How to Buy Tokens

1. **Select a Token**: Browse the **Explore** page or click any token card to open its dedicated Trade View.
2. **Review the Chart & Metrics**:
   - View live price candles and 24-hour volume trends.
   - Check whether the token is currently **On Curve** (climbing toward graduation) or **Graduated** (trading on Uniswap DEX).
   - Review community metrics, top holders, and creator status badges.
3. **Choose Buy Mode**: In the trade panel on the right, ensure the **Buy** tab is active.
4. **Enter Amount**:
   - Type the amount of ETH you want to spend, or use quick-select buttons (`0.01`, `0.05`, `0.1`, `0.5 ETH`).
   - The panel automatically calculates your estimated tokens received.
5. **Adjust Slippage (Optional)**:
   - Click the settings gear icon to configure your slippage tolerance (preset options: 0.5%, 1.0%, 2.0%, or custom).
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
