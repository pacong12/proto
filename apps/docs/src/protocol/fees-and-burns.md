# Fees & Buyback Split

Proto aligns token creators and protocol longevity through a fair, transparent fee distribution model.

---

## 70/30 Fee Distribution

Every trade on a Proto Uniswap V3 pool generates a **1% pool fee** in both WETH and the launched token.
The fees accumulate inside the locked position NFT and are split as follows:

```text
                                  Total Trading Fee (1%)
                                            |
                    +-----------------------+-----------------------+
                    |                                               |
              Creator Share (70%)                             Protocol Share (30%)
                    |                                               |
        +-----------+-----------+                       +-----------+-----------+
        |                       |                       |                       |
  Creator Wallet        Holder Redirect (CTO)      TWAP Buyback (80%)      Operations (20%)
```

### Creator Rewards (70%)

- The token creator can call `claimFees(tokenAddress)` at any time via the Proto web app.
- Creators receive 70% of accumulated WETH and 70% of accumulated token fees.
- Creators can redirect their fee stream to a community multisig or token holders using `setFeeRedirect()`.

### Protocol Revenue & Automated Buyback (30%)

- **80% of Protocol Fees**: Routed to `BuybackBurner.sol`, which executes automated TWAP swaps on Uniswap V3 to purchase the native platform utility token and permanently burn it to `0x000000000000000000000000000000000000dEaD`.
- **20% of Protocol Fees**: Allocated to infrastructure servers, indexers, and core team operations.
