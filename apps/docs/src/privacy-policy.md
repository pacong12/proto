# Privacy Policy

<Badge variant="graduated">Last Updated: September 2026</Badge>

<Card>
Proto Labs and the Proto Protocol operate a non-custodial token launch and decentralized exchange interface on Robinhood Chain (Chain ID: 4663). We prioritize data minimization, user sovereignty, and cryptographic privacy.
</Card>

## 1. Information We Do Not Collect

Because Proto is non-custodial and direct-to-contract:

- **No Private Keys**: We never generate, handle, or store private keys or seed phrases.
- **No Custodial Accounts**: There are no email registrations, passwords, or custodial user balances.
- **No Financial Tracking**: We do not sell user data, financial activity profiles, or behavioral analytics.

## 2. Information Handled Onchain

When you interact with the Proto smart contracts on Robinhood Chain:

- **Public Wallet Address**: Your Ethereum-compatible address interacts with the Launchpad Factory and Uniswap V3 Pool contracts.
- **Transaction Data**: Token deployments, liquidity locks, fee claims, and swaps are publicly broadcast and permanently recorded on the blockchain ledger.
- **Public RPC Calls**: Standard JSON-RPC queries (`eth_call`, `eth_getBalance`, `eth_getLogs`) are serviced by the designated network RPC node.

## 3. Local Storage Usage

The frontoffice application stores limited preference state strictly in your browser's `localStorage`:

- Wallet connection status and last active provider identifier.
- Color theme preference (Dark / Light mode).
- Confirmation of terms & privacy policy agreement (`proto_privacy_policy_accepted_v1`).

You may clear your browser storage at any time to remove these local settings.

## 4. Third-Party Protocols & Infrastructure

Interactions may route through decentralized infrastructure:

- **Robinhood Chain (L2)**: Block execution and transaction consensus.
- **Uniswap V3 Core**: Automated market maker and concentrated liquidity contracts.
- **IPFS Gateways**: Decentralized hosting of token icons and self-describing metadata.

## 5. Security & Invariants

All protocol backend services enforce fail-closed security policies (`INV-BE-3`) and reject direct signing (`INV-BE-1`). Smart contract positions are permanently locked in non-custodial lockers (`INV-SC-2`).

<Card>
For legal inquiries, protocol disclosures, or technical support, visit the [GitHub repository](https://github.com/pacong12/proto) or follow official community channels.
</Card>
