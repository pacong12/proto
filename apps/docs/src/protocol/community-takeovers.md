# Community Takeovers (CTO)

What happens if a token developer steps away or abandons a project?

Unlike typical launchpads where abandoned projects immediately wither away, Proto features a native **Community Takeover (CTO)** framework that allows active holders to revive the project and claim creator fee revenues.

---

## What is a Community Takeover?

A Community Takeover occurs when enthusiastic community members organize to adopt an abandoned token, take over marketing, update social links, and maintain community growth.

Proto supports this through smart contract fee redirection:

1. **Creator Delegation**: The original creator can voluntarily transfer their 70% trading fee stream to a trusted community wallet, multisig, or DAO address via the **Profile** interface.
2. **Community Application**: If a creator has disappeared or sold their entire position, community members can submit verifiable proof of adoption. Upon verification, the creator fee stream is redirected to benefit the community.

---

## Security & Protection Guarantees

- **Liquidity is Untouchable**: Liquidity remains permanently locked inside `LiquidityLocker.sol`. A Community Takeover cannot withdraw, migrate, or drain the pool's liquidity.
- **Token Contract is Immutable**: Token rules, total supply (1 Billion), and transfer parameters cannot be modified or reconfigured by anyone.
- **Non-Custodial Transparency**: All fee claims and redirects are recorded transparently on Robinhood Chain for public verification.
