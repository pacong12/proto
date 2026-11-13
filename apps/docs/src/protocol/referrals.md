# Invite Friends & Referrals

Every profile has a **Refer friends** card with a personal invite link. When someone opens Goton through your link and connects a wallet, that wallet is credited to you. Attribution is **off-chain and first-touch**, so it costs no gas and never needs a signature.

---

## Your Invite Link

Open your own profile and find the **Refer friends** card. It shows:

- **Your invite link** — `https://goton.fun/?ref=<your-username>`, using your wallet's username (e.g. `aerobrassgriffin-79c8`). A wallet address works too; the username is just friendlier to read and share.
- **Referred** — how many wallets you have referred so far.
- **Copy link** — copies the link to your clipboard.

The same `?ref=` code rides along automatically whenever you share from Goton — see [Where your link travels](#where-your-link-travels).

---

## How Attribution Works

- **First-touch.** The first invite link a visitor opens is the one that counts. It is remembered in their browser until they connect a wallet, and a later invite link does **not** overwrite it.
- **One wallet, once.** When the visitor connects a wallet, that wallet is attributed to your link a single time. Connecting again, or opening another link afterwards, changes nothing.
- **No self-referral.** Opening your own link and connecting your own wallet records nothing.
- **Username or address.** A `?ref=` that is a username is resolved back to the referrer's wallet before it is recorded; a referrer who has never traded or launched may not resolve by name, in which case an address link is the reliable form.

Because attribution is first-touch and off-chain, the worst a spoofer can do is inflate a cosmetic count. The count is informational today — there are no on-chain rewards tied to it yet.

---

## Where Your Link Travels

Your referral code is added to the links you share from inside the app, so sharing your activity also grows your network:

| Action | What gets shared |
| :----- | :--------------- |
| **Share profile** | A link to the profile, carrying *your* connected wallet's `?ref` |
| **Share PnL card** | Your `/pnl/…` card link with `?ref` |
| **Share to X** from a token / trade | The token page link with `?ref` |
| **Share a call** or post | The `/post/…` link with `?ref` |

In every case the code is the **connected** wallet's — the person sharing — so sharing someone else's profile still credits you.

---

## FAQ

**Do I earn anything for referrals today?** Not yet. The count is cosmetic for now. When rewards are introduced, attribution is expected to move to a signed, on-chain trigger (such as the referee's first launch or trade).

**Can I change who referred me?** No. First-touch is permanent once a wallet connects.

**My link uses my username — is that stable?** The username is derived from your wallet address, so it never changes.
