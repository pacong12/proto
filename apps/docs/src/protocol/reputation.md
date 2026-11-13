# Creator Reputation

Every profile shows the creator's **launch track record** — a quick, on-chain-derived summary of what they have shipped. It helps traders judge a new token by the history of the wallet behind it.

---

## What It Shows

The reputation card on a creator's profile summarises every token that wallet has launched:

| Metric               | Meaning                                                                         |
| :------------------- | :------------------------------------------------------------------------------ |
| **Launches**         | How many tokens the wallet has created                                          |
| **Graduated**        | How many of those completed their bonding curve and moved to a Uniswap v4 pool  |
| **Active**           | How many are still live and trading                                             |
| **Graduation rate**  | Graduated ÷ launches, as a percentage                                           |
| **Total market cap** | The combined USD market cap of the creator's tokens                             |
| **Top token**        | The creator's largest token by market cap, with its name, symbol and market cap |

---

## How It's Computed

- The figures are built from **on-chain data** — the tokens the wallet deployed and their current market state — not anything the creator types in.
- **Nothing here is self-reported.** A creator cannot edit these numbers; they reflect the launches tied to the address.
- Building something? The same figures are available through the [Public API](/integration/api).
- **Graduation** means the token finished its bonding curve and its liquidity moved to a locked Uniswap v4 pool — see [How to Launch](/protocol/launches) and [Anti-Snipe & Fair Launch](/protocol/anti-snipe).

---

## Reading It as a Trader

- A high **graduation rate** across several launches is a stronger signal than a single graduated token.
- A wallet with many launches but few graduated or active tokens has a history of tokens that stalled — worth weighing before you buy.
- Reputation is one input, not a guarantee. Always combine it with the token's own liquidity, holders and the safety notes in the [Trading Guide](/protocol/trading-guide).
