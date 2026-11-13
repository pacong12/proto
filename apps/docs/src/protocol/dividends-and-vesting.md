# Holder Dividends & Vesting

The **Dividends** tab on your profile is where two kinds of on-chain rewards are collected: **holder fee-sharing dividends** on tokens you hold, and **vested tokens** from allocations that unlock over time. Both are claimed directly to your wallet.

---

## Holder Dividends

Some tokens turn on **Holder Fee Sharing** at launch. For those tokens, a share of trading fees accrues **pro-rata to everyone holding the token** — not just the creator.

On the Dividends tab you'll see:

- **Total claimable** — your accrued rewards, listed per currency (ETH / WETH on Robinhood, USDC on Arc).
- **Per-token entries** — each token you hold that shares fees, with the amount waiting for you.
- **Claim all** — collect every token's dividends in one go, or claim a single token from its row.

Rewards keep accruing as the token trades; claiming sweeps what has built up to your wallet. A token only appears here if its creator enabled Holder Fee Sharing — see [Creator Fees & Rewards](/protocol/fees-and-burns) for how the fee split is configured.

---

## Vesting

When a token grants you an allocation that unlocks over time (for example a creator or contributor allocation), its **vesting schedule** shows on the same tab, per token:

| Field                    | Meaning                                         |
| :----------------------- | :---------------------------------------------- |
| **Total (still locked)** | Tokens not yet unlocked                         |
| **Claimed**              | Tokens you have already released to your wallet |
| **Claimable**            | Unlocked tokens you can release right now       |
| **Cliff ends**           | The date before which nothing unlocks           |
| **Fully unlocked**       | The date the whole allocation has vested        |

A schedule has a **cliff** (nothing releases until that date) and then unlocks gradually until it is fully vested. Two actions are available on a vesting position:

- **Claim tokens** — release the currently claimable (unlocked) tokens to your wallet.
- **Claim dividends** — collect the holder fee-sharing dividends earned by that vesting position.

---

## Notes

- Everything here is **on-chain**. Claiming is a wallet transaction; the vesting and fee-sharing logic lives in the token's contracts, with no admin able to redirect your rewards.
- The tab shows your own claimable amounts and vesting only on **your** profile (connect your wallet). Amounts update as tokens trade and as unlocks pass their cliff.
