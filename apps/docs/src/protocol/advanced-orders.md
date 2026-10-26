# Limit, Take-Profit & Stop-Loss Orders

Besides buying and selling at the live price, the trade panel has two more tabs: **Limit** and **TP / SL**. Both place an order in the `GotonLimitOrders` contract, which holds your funds until the order fills or you cancel it.

---

## The Three Order Types

| Order           | What you deposit              | Fills when                                                                              |
| :-------------- | :---------------------------- | :-------------------------------------------------------------------------------------- |
| **Limit buy**   | ETH (Robinhood) or USDC (Arc) | The market cap falls to your target, so you receive at least the tokens you were quoted |
| **Take profit** | Tokens                        | The market cap rises to your target, so you receive at least the quoted amount          |
| **Stop loss**   | Tokens                        | The market cap falls to your stop, then sells with your slippage limit                  |

Targets are entered as a **market cap in USD**, which the app converts into the on-chain price and the minimum you receive. That minimum already accounts for the pool or curve fee, the token's tax and the 0.1% executor fee, so an order fills when the market reaches your target, not later.

A take profit and a stop loss can share one deposit (**one-cancels-other**): the first leg to fill closes the order and the other leg is gone.

---

## How Orders Fill

- **Anyone can fill an order** once its condition is met. Goton runs a keeper that checks open orders every 15 seconds and fills them, but the contract accepts any caller.
- **The filler earns 0.1%** of the quote side (the executor fee). The keeper only fills when that fee covers its gas, so very small orders may wait until someone else fills them, or until you cancel.
- **Stop losses use a manipulation-resistant price.** On a bonding curve the stop triggers only when both the curve's spot price and its TWAP (time-weighted average over about 10 to 20 minutes) are at or below your stop. On a Uniswap v4 pool it triggers on the pool's TWAP from the Goton hook. Either way, a single block's price push cannot trigger your stop, and a stop on a new token waits until the price has about 10 minutes of history.
- **Every fill is checked against your balance change.** The contract measures what actually reached your wallet, not what a router reports, and refunds anything a partial fill leaves over.

---

## Escrow, Expiry & Cancelling

- Your deposit stays in the contract until the order fills or you cancel it. The contract has **no owner and no admin functions**: escrowed funds can only fill your order on your terms or return to you.
- Every order has an expiry (1, 7 or 30 days). After that it can no longer fill, but **cancel still works**, at any time, and returns the full deposit.
- Cancel from the **Open orders** list under the trade panel.

---

## Order History & Notifications

- The panel under the trade form has two tabs: **Open** and **History**. History lists filled and cancelled orders with the leg that filled, what you received and a link to the closing transaction.
- While your wallet is connected, the app checks your orders every 20 seconds on any page and shows a notification when one fills.

---

## Where Orders Are Available

| Chain           | Bonding curve tokens            | Uniswap v4 pools                |
| :-------------- | :------------------------------ | :------------------------------ |
| Robinhood Chain | Tokens from the current factory | Graduated tokens                |
| Arc Network     | — (Arc has no curves)           | Tokens from the current factory |

The Limit and TP / SL tabs only appear on tokens where an order can fill. Tokens from earlier factories do not show them.

Contract addresses are listed in [Verified Smart Contracts](/integration/contracts).
