# Creator Fees & Rewards

Goton aligns the long-term success of token creators with their communities by offering one of the most creator-friendly fee structures in the entire blockchain ecosystem.

---

## 70/30 Fee Distribution

Where fees come from depends on the chain:

- **Robinhood Chain**: while a token is on its bonding curve, each curve trade pays a 1% fee to the protocol. After graduation, the locked Uniswap v4 pool charges a 1% LP fee.
- **Arc Network**: the Uniswap v4 pool charges a 1% LP fee from launch, plus an optional buy/sell tax of 0–10% that the creator sets at launch.

Pool fees and taxes are split by each token's on-chain fee splitter:

- **30% to the protocol** treasury.
- **70% to the creator's share**, which the creator can divide once, before public trading starts, between:
  - **Creator**: claimable by the creator (or their redirected recipient).
  - **Holders**: streamed to token holders pro-rata over 24 hours.
  - **Buyback & Burn**: bought back in the token's own pool by the `GotonV4Buyback` contract and sent to the dead address. Each buyback is capped at the pool's 30-minute TWAP ± 2%, so a manipulated price only pauses the buyback until it normalises.
  - **Liquidity**: sent to the protocol liquidity vault, which is currently the protocol treasury. The goton.fun app does not offer this option, because it does not add liquidity to the token's own pool.

By default the whole 70% goes to the creator. The protocol share is not used for buybacks.

---

## How Creators Claim Rewards

1. Connect the wallet that originally created the token.
2. Go to your **Profile** page (`/profile`).
3. Under the **My Launches** section, view your accumulated uncollected ETH and token rewards.
4. Click **Claim Fees** to withdraw your rewards directly to your wallet in a single transaction.

---

## Fee Redirection (Community Takeovers)

If a creator wishes to reward their community or hand over project leadership:

- Creators can redirect their creator fee stream to a DAO treasury, community multisig, or reward contract. A redirect takes effect 48 hours after it is proposed and can be cancelled in that window.
- This feature empowers community takeovers (CTO) by turning project revenue into community-owned funding.
