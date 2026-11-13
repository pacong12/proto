# Profiles & Identity

Every wallet on Goton has a public profile and a built-in **pseudonym**, so people have a name and a page from their very first trade — no sign-up required. You can customise your profile whenever you connect your wallet.

---

## Your Pseudonym

The moment a wallet appears, Goton gives it a deterministic username derived from the address — an adjective, a material and an archetype, plus a short tag from the address, for example **AeroBrassGriffin#79c8**. From it come three forms, all pointing at the same wallet:

- **Display name** — `AeroBrassGriffin#79c8`
- **Handle** — `@AeroBrassGriffin#79c8`
- **Slug** — `aerobrassgriffin-79c8` (the URL-safe form)

Because it's derived from the address, your pseudonym **never changes** and is the same everywhere in the app. It's also what your [referral link](/protocol/referrals) uses.

---

## Profile URLs

A profile opens from several equivalent paths, which all resolve to the same wallet:

- `/u/<address>`, `/profile/<address>`, `/user/<address>`, `/@<address>`
- `/<username>` — the slug, e.g. `/aerobrassgriffin-79c8`

An address URL is rewritten to the clean `/<username>` form. A typed name, slug or handle is resolved back to its address, so sharing a name works as well as sharing an address.

---

## Editing Your Profile

On your **own** profile (with your wallet connected), **Edit Profile** lets you customise your public creator identity:

| Field             | Notes                                                  |
| :---------------- | :----------------------------------------------------- |
| **Cover banner**  | An image uploaded from your device                     |
| **Profile photo** | An avatar uploaded from your device                    |
| **Display name**  | Up to 32 characters; overrides the pseudonym publicly  |
| **Bio**           | A short description — strategies, your alpha, anything |
| **X (Twitter)**   | Your handle                                            |
| **Telegram**      | Your handle                                            |

Uploaded images are stored on IPFS; the rest of the profile is saved for your wallet. You can also **erase** your social data to clear the custom fields and fall back to the pseudonym.

---

## What a Profile Shows

Every profile — yours or anyone's — collects that wallet's activity in one place:

- **[Creator Reputation](/protocol/reputation)** — their launch track record.
- **[Portfolio](/protocol/portfolio)** — performance and current holdings.
- **Posts & Calls** — their [feed activity](/protocol/social).
- **Created Tokens** — tokens the wallet launched.
- **[Holder Dividends & Vesting](/protocol/dividends-and-vesting)** — claimable rewards (own profile).
- **[Refer friends](/protocol/referrals)** — their invite link (own profile).

---

## Notes

- A profile is **public** and built from on-chain activity plus the optional fields you set. It exposes nothing beyond what the chain and your own edits provide.
- No account, email or password exists — your wallet _is_ your identity.
