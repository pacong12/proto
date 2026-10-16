# Privacy Policy

<Badge variant="graduated">Last Updated: October 2026</Badge>

<Card>
Goton Labs and the Goton Protocol operate a non-custodial token launch and decentralized exchange interface on Robinhood Chain (Chain ID: 4663) and Arc Network (Chain ID: 5042). We prioritize data minimization, user sovereignty, and cryptographic privacy.
</Card>

## 1. Information We Do Not Collect

Because Goton is non-custodial and direct-to-contract:

- **No Private Keys**: We never generate, handle, or store private keys or seed phrases.
- **No Custodial Accounts**: There are no email registrations, passwords, or custodial user balances.
- **No Data Sales**: We do not sell user data or financial activity profiles.

## 2. Information Handled Onchain

When you interact with the Goton smart contracts on Robinhood Chain or Arc Network:

- **Public Wallet Address**: Your Ethereum-compatible address interacts with the Launchpad Factory, bonding curve and Uniswap v4 pool contracts.
- **Transaction Data**: Token deployments, liquidity locks, fee claims, and swaps are publicly broadcast and permanently recorded on the blockchain ledger.
- **Public RPC Calls**: Standard JSON-RPC queries (`eth_call`, `eth_getBalance`, `eth_getLogs`) are serviced by the designated network RPC node.

## 3. Local Storage Usage

The frontoffice application stores limited preference state strictly in your browser's `localStorage`:

- Wallet connection status and last active provider identifier.
- Color theme preference (Dark / Light mode).
- Confirmation of terms & privacy policy agreement (`proto_privacy_policy_accepted_v1`).

You may clear your browser storage at any time to remove these local settings.

## 3a. Off-chain Data, Analytics & Your Rights

- **Social features**: comments, likes, reposts, sentiment votes and creator profiles you submit are stored by the Goton API together with your wallet address and shown publicly.
- **Server logs**: the API keeps request logs for security and rate limiting. Client IP addresses are written to logs only as a one-way hash.
- **Analytics**: the web app loads Google Analytics (`gtag.js`), which sets cookies and sends page-view and device data to Google.
- **Erasure**: you can delete your comments, likes, reposts, sentiment votes and profile at any time from **Profile → Edit Profile → Delete my social data** (API: `DELETE /api/users/{address}/data`, signed in with that wallet). Onchain records cannot be erased by anyone.

## 4. Third-Party Protocols & Infrastructure

Interactions may route through decentralized infrastructure:

- **Robinhood Chain (L2) and Arc Network**: Block execution and transaction consensus.
- **Uniswap v4**: Pool manager contracts that hold locked liquidity and execute swaps.
- **Google Analytics**: Page-view analytics on the web app (see section 3a).
- **IPFS Gateways**: Decentralized hosting of token icons and self-describing metadata.

## 5. Security & Invariants

All protocol backend services enforce fail-closed security policies (`INV-BE-3`) and reject direct signing (`INV-BE-1`). Smart contract positions are permanently locked in non-custodial lockers (`INV-SC-2`).

<Card>
For legal inquiries, protocol disclosures, or technical support, visit the [GitHub repository](https://github.com/pacong12/proto) or follow official community channels.
</Card>
