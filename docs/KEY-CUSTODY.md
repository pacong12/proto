# Key Custody Runbook

The protocol owner key `0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2` is a single EOA whose private
key sits in a local `.env` (`PRIVATE_KEY`). Anyone who copies that file controls the contracts below.
This runbook moves ownership to a Safe multisig and keeps hot keys limited to jobs that cannot move
funds.

## What the owner key controls today (Robinhood Chain, read on-chain 2026-10-18)

| Contract                                | Address                                      | Owner-only powers                                                                                                | Impact if the key leaks                                                                               |
| --------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| LaunchpadV2Factory (live, pre-v4 build) | `0x9f1fAf78adE92C994AB188452338b45c52800748` | `setLaunchFee` (no cap), `migrateCurveToV4(curve, recipient)`, `emergencyWithdrawFromCurve`, `transferOwnership` | Sends the ETH and tokens of every **graduated** curve to any address (no delay); unlimited launch fee |
| LiquidityLocker                         | `0x7A1AD6AD30B1c9e276eD80a853E8dA897fE5D63E` | `setProtocolFeeRecipient`, `setHolderFeeDistributor`, `transferOwnership`                                        | Redirects protocol fees and the holders' fee stream                                                   |
| Protocol fee recipient                  | same EOA                                     | Receives launch fees and the 1% curve fee                                                                        | Fees received so far and in future                                                                    |

The live factory's fee recipient has no setter, so curve fees from that factory keep going to the
EOA. Sweep that balance to the Safe regularly until the next factory deployment, which sends fees to
the Safe directly.

No curve has graduated yet (6 launches, 0.000099 ETH in curves), so the exposure today is small. It
grows with the first graduation (4.2 ETH per curve).

## Target setup

| Role                                                          | Holder                                   | Can move funds                                                  |
| ------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------- |
| Owner of factories, graduator, buyback, locker; fee recipient | Safe, 2-of-3, owners on hardware wallets | Yes, with 2 signatures                                          |
| Emergency guardian (`EMERGENCY_GUARDIAN`)                     | Hot key                                  | No: it can only pause; unpause is owner-only                    |
| Keeper (`KEEPER_PRIVATE_KEY`)                                 | Hot key on the VPS                       | No: gas only, every call is permissionless                      |
| Deployer                                                      | Throwaway key per deployment             | No: hands ownership to the Safe in the deploy transaction batch |

Safe v1.4.1 (SafeL2, proxy factory, fallback handler) is deployed at the canonical addresses on both
Robinhood Chain (4663) and Arc (5042). The scripts below use them through `cast`, so they work
whether or not the Safe web app lists these chains.

## 1. Create the Safe (once per chain)

Use three owner addresses on separate devices, ideally hardware wallets, and threshold 2.

```bash
scripts/safe/create-safe.sh --rpc-url https://rpc.mainnet.chain.robinhood.com --threshold 2 \
  --owner 0xOWNER_A --owner 0xOWNER_B --owner 0xOWNER_C -- --ledger
# prints SAFE=0x...
```

Repeat on Arc (`--rpc-url https://rpc.mainnet.arc.io`). Using the same `--salt` and owners gives the
same Safe address on both chains.

## 2. Hand over the live Robinhood contracts

Ownership moves in two steps: the old key proposes, the Safe accepts.

```bash
RPC=https://rpc.mainnet.chain.robinhood.com
FACTORY=0x9f1fAf78adE92C994AB188452338b45c52800748
LOCKER=0x7A1AD6AD30B1c9e276eD80a853E8dA897fE5D63E

# Old owner proposes (last use of the hot key):
cast send $FACTORY "transferOwnership(address)" $SAFE --private-key $PRIVATE_KEY --rpc-url $RPC
cast send $LOCKER  "transferOwnership(address)" $SAFE --private-key $PRIVATE_KEY --rpc-url $RPC

# The Safe accepts, one Safe transaction per contract:
DATA=$(cast calldata "acceptOwnership()")
scripts/safe/safe-tx.sh hash --rpc-url $RPC --safe $SAFE --to $FACTORY --data $DATA
#   each of two owners, on their own device:
scripts/safe/safe-tx.sh sign --hash 0xHASH -- --ledger        # prints OWNER:SIGNATURE
#   anyone (pays gas):
scripts/safe/safe-tx.sh exec --rpc-url $RPC --safe $SAFE --to $FACTORY --data $DATA \
  --sig OWNER_A:0x... --sig OWNER_B:0x... -- --account deployer
# Repeat hash/sign/exec with --to $LOCKER (the Safe nonce has moved on, so hash again).

# Then, from the Safe, send locker fees to the Safe:
DATA=$(cast calldata "setProtocolFeeRecipient(address)" $SAFE)   # hash / sign / exec as above
```

Check: `cast call $FACTORY "owner()(address)" --rpc-url $RPC` returns the Safe, and a call from the
old key, for example `setLaunchFee`, reverts with `Unauthorized`. This flow was rehearsed on a
Robinhood mainnet fork: a single signature is refused, two signatures move ownership, and the old
key is rejected afterwards.

## 3. New deployments

`DeployRobinhoodV2.s.sol` and `DeployArc.s.sol` refuse to deploy to mainnet without `OWNER_SAFE`
(override with `ALLOW_EOA_OWNER=true` only for rehearsals). With it set, the fee recipient defaults
to the Safe and the factory, graduator and buyback ownership is proposed to the Safe. Finish with
one `acceptOwnership()` Safe transaction per contract, as in step 2.

## 4. Retire the hot owner key

1. Sweep the remaining balance of `0x555C…b0c2` to the Safe (keep a little gas until the last
   sweep of live-factory fees).
2. Delete `PRIVATE_KEY` from every `.env`, password manager entry and CI secret that holds it.
3. Use a fresh throwaway deployer key for future deployments.
