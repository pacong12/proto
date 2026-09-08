# Anti-Snipe Protection

To protect retail participants and prevent MEV bots from exhausting initial pool liquidity, Proto enforces hardcoded smart contract rules during the first **2 blocks** post-launch.

---

## Launch Window Restrictions

```text
Launch Block (Block 0)           Blocks 1 - 2                    Block 3+ (Permanent)
+------------------------+      +--------------------------+    +----------------------+
| Only Creator Buy       | ---> | Max Buy: 5.5% (55M)      | -> | All Limits Expired   |
| (Whitelisted Deployer) |      | Max Wallet: 5.0% (50M)   |    | Open Uncapped Market |
+------------------------+      +--------------------------+    +----------------------+
```

### 1. Block 0 (The Launch Block)

Only the token deployer's initial buy can execute against the Uniswap V3 pool.
All other purchases from the pool in the same block will revert with `OnlyDeployerCanBuyAtLaunchBlock()`.

### 2. Blocks 1 and 2

- **Maximum Purchase**: A single buy transaction cannot exceed **5.5% of total supply** (55,000,000 tokens). Reverts with `MaxBuyExceeded()`.
- **Maximum Wallet Balance**: A recipient cannot hold more than **5.0% of total supply** (50,000,000 tokens) post-purchase. Reverts with `MaxWalletExceeded()`.

### 3. Non-Restricted Actions

- **Selling**: Selling tokens back to the pool is **never restricted** at any block.
- **Transfers**: Peer-to-peer wallet transfers are **never restricted**.

### 4. Post-Window (Block 3 and Beyond)

All buy and wallet limits expire automatically without requiring any administrative transaction.
