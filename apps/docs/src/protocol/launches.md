# How Launches Work

Proto streamlines token deployment into a single, atomic onchain workflow.

```text
+-------------------------------------------------------------------------+
|                  LaunchpadFactory.launchToken() (1 Tx)                  |
+-------------------------------------------------------------------------+
       |
       +---> 1. Deploy LaunchpadToken (1,000,000,000 fixed supply)
       +---> 2. Create Uniswap V3 Pool (Token / WETH @ 1% fee tier)
       +---> 3. Initialize pool price (sqrtPriceX96)
       +---> 4. Mint full liquidity position to NonfungiblePositionManager
       +---> 5. Transfer & lock LP NFT permanently in LiquidityLocker
       +---> 6. Link pool to token for 2-block anti-snipe restrictions
       +---> 7. (Optional) Execute creator initial purchase
```

---

## 3-Step Lifecycle

### Step 1: Create

The creator calls `launchToken` on `LaunchpadFactory`, specifying:

- Token `name`, `symbol`, `logo` IPFS URI, and `description`.
- Social metadata (`twitter`, `telegram`, `discord`, `website`, `farcaster`).
- Optional `initialBuyAmount` (ETH) paired directly into the new pool.

### Step 2: Trade

Once deployed, anyone can buy and sell the token against WETH using the canonical Uniswap V3 `SwapRouter`.
Each trade accrues a 1% liquidity fee in both the token and WETH.

### Step 3: Graduate

When the WETH paired in the pool reaches **4.2 ETH**, the launch achieves **Graduation** status.

- Trading continues seamlessly in the exact same pool.
- No migration, token bridging, or pool re-creation is required.
