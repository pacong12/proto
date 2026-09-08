# Community Takeovers (CTO)

When a token creator abandons a project or steps away, Proto empowers active token holders to take over the project's fee stream and social presence.

---

## How CTO Works

1. **Creator-Initiated Delegation**:
   The deployer can call `setFeeRedirect(tokenAddress, newRecipientAddress)` in `LiquidityLocker.sol` to permanently or temporarily redirect their 70% trading fee stream to a community multisig or DAO treasury.

2. **Community Application**:
   If the creator is inactive, community leaders can submit a CTO request with verifiable onchain proof. The team verifies community consensus and reconfigures the recipient on `LiquidityLocker`.

---

## Security Guarantees

- **Liquidity is Untouchable**: The Uniswap V3 liquidity position remains permanently locked in `LiquidityLocker`. A CTO only alters the **fee recipient address**, not the liquidity pool or token contracts.
- **Non-Custodial**: Neither Proto nor any community administrator can withdraw or drain liquidity from the pool.
- **Immutable Token**: Token rules, total supply (1 Billion), and pool parameters remain immutable forever.
