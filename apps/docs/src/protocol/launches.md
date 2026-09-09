# How Launches Work

Proto provides two distinct launch models matching modern launchpad standards:

1. **v1 Direct Pool**: Atomic deployment into a permanently locked Uniswap V3 liquidity pool.
2. **v2 Bonding Curve**: Constant-product price discovery curve with automatic graduation once 4.2 ETH is raised.

---

## Lifecycle Stages: On Curve vs Graduated

Every token on Proto exists in one of two lifecycle stages:

- **On Curve** _(Climbing toward graduation)_:
  The token trades against the mathematical bonding curve. 800,000,000 tokens are available for public purchase. The price rises as more tokens are bought and falls as tokens are sold. Once the curve accumulates **4.2 ETH**, trading on the curve ends and graduation begins.
- **Graduated** _(Uniswap DEX Pool)_:
  The bonding curve is completed. The accumulated 4.2 ETH paired with 200,000,000 reserved tokens is deposited directly into a canonical Uniswap liquidity pool, and the liquidity position NFT is permanently locked in the Locker. Trading continues normally in Uniswap DEX.

---

## Comparison: v1 vs v2 Architecture

| Feature                   | v1 (Direct Pool)                                        | v2 (Bonding Curve)                                  |
| :------------------------ | :------------------------------------------------------ | :-------------------------------------------------- |
| **Initial Market**        | Uniswap V3 Pool                                         | Onchain `BondingCurve` Contract                     |
| **Lifecycle**             | Directly Graduated (Locked Pool)                        | Starts On Curve -> Graduates at 4.2 ETH             |
| **DEX Liquidity**         | Seeded immediately at launch                            | Seeded upon graduating (4.2 ETH)                    |
| **Token Supply Split**    | 100% (1 Billion) minted to Pool                         | 800M on Curve, 200M reserved for Pool               |
| **Anti-Snipe Protection** | 2-Block Rule (Block 0 dev only, Block 1-2 max 5.5% buy) | Decaying Snipe Tax (99% at 0s decaying to 0% in 5s) |
| **Trading Asset**         | WETH (Uniswap Router)                                   | ETH / Paired Asset directly with Curve              |
| **Graduation Event**      | Reaching 4.2 ETH paired in pool                         | Curve sells out & migrates ETH + 200M tokens to DEX |

---

## v1 Direct Pool Workflow

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

## v2 Bonding Curve Workflow

```text
+-------------------------------------------------------------------------+
|                LaunchpadV2Factory.launchTokenV2() (1 Tx)                |
+-------------------------------------------------------------------------+
       |
       +---> 1. Deploy LaunchpadToken (1,000,000,000 fixed supply)
       +---> 2. Deploy BondingCurve contract (Virtual Reserve x * y = k)
       +---> 3. Transfer 100% token supply to the Curve
       +---> 4. Public trades against Curve (Buy & Sell with instant liquidity)
       +---> 5. 99% snipe tax decays exponentially to 0% across 5 seconds
       +---> 6. Once 4.2 ETH is raised -> Auto-graduates & locks pool liquidity
```

---

## Community Takeover Migration (Dead Coin Rescue)

Proto includes support for **Migration of abandoned or rugged tokens**:

1. **Epoch Deposits**: Communities of rugged or abandoned tokens can deposit their old tokens into structured migration epochs.
2. **Paced Recovery Sale**: A non-custodial automated contract executes time-paced recovery sales of deposited old tokens into existing liquidity.
3. **New Replacement Token**: Recovered proceeds fund a clean new token deployment on Proto with locked Uniswap liquidity, allowing the community to reclaim their positions with linear vesting.
