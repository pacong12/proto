# Anti-Snipe & Fair Launch Safeguards

One of the biggest frustrations in crypto trading is losing early opportunities to automated sniper bots that buy up pool liquidity within milliseconds.

Proto incorporates built-in, hardcoded smart contract rules during the opening blocks of a launch to ensure everyday community members have a fair chance to participate.

---

## How It Works

### For v1 Direct Pools (Uniswap V3)

During the first 2 blocks after a token pool is initialized:

1. **Block 0 (Creation Block)**:
   - Only the creator's optional initial buy can execute alongside contract creation.
   - Any external bot attempting to sandwich or front-run in the same block is automatically rejected.
2. **Blocks 1 and 2**:
   - **Maximum Purchase Per Order**: No single transaction can purchase more than **5.5% of total supply** (55,000,000 tokens).
   - **Maximum Wallet Hold**: No individual wallet can hold more than **5.0% of total supply** (50,000,000 tokens).
3. **Block 3 and Beyond**:
   - All restriction limits expire automatically in the smart contract bytecode. The market becomes completely open, standard, and uncapped.
   - **Selling is Never Restricted**: Anyone who buys can sell back to the pool at any time, even during the restriction window.

---

### For v2 Bonding Curves

On bonding curves, Proto employs a **dynamic decaying sniper fee**:

- At the exact second of launch ($t=0$), an automated 99% tax applies to any predatory bot attempting instant execution.
- The fee rapidly decays over the next 3 seconds ($t=1 \to 25\%$, $t=2 \to 3\%$, $t \ge 3 \to 0\%$).
- Within seconds, standard zero-tax trading resumes smoothly for normal human traders.

---

## Transparency & Safety Guarantees

- **No Whitelists or Gatekeepers**: Anyone with a Web3 wallet can participate once the fair launch window opens.
- **No Admin Switches**: Anti-snipe limits are mathematically hardcoded into the contract and expire without human intervention.
- **Selling Always Enabled**: There are no artificial lockups or withdrawal cooldowns on tokens purchased by users.
