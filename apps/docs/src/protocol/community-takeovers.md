# Community Takeovers (CTO)

What happens if a token developer wants to step away from a project?

On Goton, a creator can hand their fee stream to the community that carries the project on. This is always the creator's own decision. Nobody else, including the protocol, can move a creator's fees.

---

## What is a Community Takeover?

A Community Takeover occurs when community members adopt a token, take over marketing, update social links, and maintain community growth.

Goton supports this through a redirect on the token's fee splitter:

1. **Propose**: The creator proposes a community wallet, multisig, or DAO address from the **Profile** page (**Created** tab, **Manage CTO**).
2. **Wait 48 hours**: The proposal cannot take effect during this timelock, so everyone can see it coming. The creator can cancel it until it is accepted. A new proposal replaces the old one and restarts the wait.
3. **Accept**: After the timelock, the creator or the proposed recipient accepts. From then on, the creator portion of the fees goes to the new recipient.
4. **Lock (optional)**: The creator can lock the current recipient permanently. This cannot be undone, and it drops any pending proposal, so accept the new recipient before locking.

Until the recipient is locked, the creator can start a new redirect at any time, again with the 48-hour timelock.

The amount redirected depends on the token. The creator chooses how the creator share is divided, so the redirect covers only the part assigned to the **Creator**. Holder, buyback, and liquidity portions keep their destinations. See [Creator Fees & Rewards](./fees-and-burns.md).

---

## How to Ask for a Takeover

1. **Organise a recipient**: Set up a multisig or DAO that the community controls, rather than one member's personal wallet.
2. **Ask the creator**: Contact the creator publicly and share the recipient address, so the request can be checked by everyone.
3. **Watch the proposal**: Once the creator proposes the address, check that it is exactly the one you agreed on.
4. **Accept after 48 hours**: The recipient can accept without waiting for the creator.
5. **Ask for the lock and verify it**: Without the lock, the creator can still redirect the fees again later.

To verify on-chain, open the token's fee splitter in the block explorer and read these values:

- `creatorRecipient()`: the address that receives the fees now.
- `creatorRecipientLocked()`: `true` means this address can never change.
- `pendingCreatorRecipient()` and `pendingCreatorRecipientValidAfter()`: any proposal waiting for its timelock.

The token's trade page also shows a **Community** badge when the fees go to someone other than the creator, and its tooltip says when the recipient is locked.

Some limits to keep in mind:

- **No creator, no redirect**: If a creator has disappeared and never proposed a redirect, the fee stream stays with them. A community can still adopt the token socially, but neither it nor Goton can claim those fees.
- **Older splitters have no lock**: Fee splitters deployed before the lock existed can redirect but cannot be locked, so the creator can always redirect again. The Profile page shows when the lock is not available.
- **Robinhood Chain**: A token gets its fee splitter at graduation, so a redirect is only possible after that.

---

## Security & Protection Guarantees

- **Liquidity is Untouchable**: Liquidity stays permanently locked, in the liquidity locker on Robinhood Chain and in the launch factory for Arc's Uniswap v4 pools. A Community Takeover cannot withdraw, migrate, or drain the pool's liquidity.
- **Token Contract is Immutable**: Token rules, total supply (1 Billion), and transfer parameters cannot be modified or reconfigured by anyone.
- **Protocol Share is Separate**: A redirect changes only who receives the creator portion. It cannot touch the protocol share or the other portions of the split.
- **Non-Custodial Transparency**: All fee claims and redirects are recorded on-chain for public verification.
