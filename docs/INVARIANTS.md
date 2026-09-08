# System Invariants & Security Guardrails

## 1. Smart Contract Invariants

- **INV-SC-1 (Supply Cap)**: Total token supply is permanently fixed at exactly 1,000,000,000 * 10^18 tokens. Minting after creation is prohibited.
- **INV-SC-2 (Non-Custodial Liquidity Lock)**: Uniswap V3 position NFT is permanently transferred to `LiquidityLocker` at creation block and cannot be withdrawn.
- **INV-SC-3 (Anti-Snipe Guard)**: During blocks `[launchBlock, launchBlock + 2]`:
  - `launchBlock`: Only the creator initial buy is permitted.
  - `launchBlock + 1` to `launchBlock + 2`: Max wallet is 5% (50M tokens), max buy is 5.5% (55M tokens).
  - Selling and peer-to-peer transfers are unrestricted.
- **INV-SC-4 (Checks-Effects-Interactions)**: All fee claims and transfers follow CEI pattern and reentrancy guards.

## 2. Backend & Security Invariants

- **INV-BE-1 (No Direct Signing)**: API never directly signs transactions with raw private keys.
- **INV-BE-2 (Intent-Gated Mutation)**: All operations must form a `TransactionIntent` and pass through `SecurityPolicy.evaluate()`.
- **INV-BE-3 (Fail-Closed Enforcement)**: If security evaluation fails or encounters errors, the intent is rejected.

## 3. Frontend Invariants

- **INV-FE-1 (User Sovereign Approval)**: Every transaction must be submitted and signed by the user connected Web3 wallet.
- **INV-FE-2 (Explicit Fee Disclosure)**: UI must display accurate pool fee, creator tax, and estimated slippage before submission.
