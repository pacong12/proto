# Privacy Policy & System Invariants

## 1. Overview

Proto Labs and the Proto Protocol operate a non-custodial token launch and decentralized exchange interface on Robinhood Chain (Chain ID: 4663). We prioritize data minimization, user sovereignty, and cryptographic privacy.

## 2. Non-Custodial Architecture

- **Zero Key Custody**: Private keys and seed phrases are never accessed, generated, or transmitted to any centralized server.
- **Direct-to-Contract**: All swap and deployment operations are constructed on the client side and signed via connected user wallets (MetaMask, Rabby, Coinbase Wallet, etc.).
- **No Personal Identifiable Information (PII)**: The protocol does not collect names, email addresses, phone numbers, or physical addresses.

## 3. Public Blockchain Data

Transactions submitted through the protocol are permanently recorded on Robinhood Chain (EVM Chain ID: 4663) and viewable on public block explorers:

- Smart contract deployments (`LaunchpadFactory.launchToken`)
- Uniswap V3 liquidity positions and NFT IDs
- Swap executions through `SwapRouter`
- Fee distributions and claims via `LiquidityLocker`

## 4. Local Browser Storage

The client application stores minimal preferences locally in `localStorage`:

- `proto-color-theme`: User theme preference (Dark / Light).
- `proto_wallet_connected`: Active wallet connection indicator.
- `proto_privacy_policy_accepted_v1`: Terms acknowledgment timestamp.

## 5. Contact & Disclosures

For audits, security inquiries, or legal notifications, contact the team via official repository issues or community channels.
