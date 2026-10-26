# Contract deploy runbook (launch release)

Step-by-step commands for deploying the launch-release contracts on Robinhood Chain (4663) and Arc
(5042). It covers keys, the treasury Safe, every deploy script, the ownership handover and the
checks. The app side (addresses, database, release order) is in `docs/RELEASE-REDEPLOY.md`.

Run everything from `contracts/` with Foundry **1.7.1** (the version CI pins), on `main`.
Verify on the explorers the app links to. Both are **Blockscout**: `robinhoodchain.blockscout.com`
and `explorer.arc.io`, and their verifier needs no API key. A plain `--verify` would use the
`[etherscan]` entries in `foundry.toml` instead (Etherscan v2, `robin.etherscan.io` and
`arc.etherscan.io`), and an Etherscan verification does not show on Blockscout. Verifying on
Etherscan as well is optional; see the end of section 7.

```bash
cd contracts
forge --version            # forge Version: 1.7.1
forge build
RH=https://rpc.mainnet.chain.robinhood.com
ARC=https://rpc.mainnet.arc.io
RH_VERIFIER="--verifier blockscout --verifier-url https://robinhoodchain.blockscout.com/api/"
ARC_VERIFIER="--verifier blockscout --verifier-url https://explorer.arc.io/api/"
```

> [!WARNING]
> The deploy scripts use `PRIVATE_KEY` from the environment when it is set, ahead of
> `--account`. Run `unset PRIVATE_KEY MNEMONIC` in the deploy shell, and check that the
> `Deployer :` line of every dry-run shows the deployer address below before you broadcast.

## 1. Deployer key

The deployer pays gas and briefly owns the contracts until the Safe accepts them. Create a new key,
used for nothing else, in an encrypted Foundry keystore. Do not put it in any `.env`.

```bash
cast wallet new                                   # prints a new address and private key
cast wallet import deployer --interactive         # paste that key, choose a password
DEPLOYER=$(cast wallet address --account deployer)
echo $DEPLOYER
```

Fund `$DEPLOYER` with about **0.002 ETH on Robinhood Chain** (the stack is about 18.7M gas, plus the
Safe, limit orders and team splitter factory) and **2 USDC on Arc** (native USDC pays gas there).

## 2. Treasury Safe

The Safe owns every contract and receives protocol fees. Use 3 signers on separate devices
(hardware wallet, second wallet, offline backup) and a threshold of 2. The deployer is **not** a
signer.

Create it on both chains with the same owners, threshold and salt, so it gets the same address on both:

```bash
SALT=$(date +%s)   # pick once, reuse for both chains
for RPC in $RH $ARC; do
  ../scripts/safe/create-safe.sh --rpc-url $RPC --threshold 2 \
    --owner 0xSIGNER_A --owner 0xSIGNER_B --owner 0xSIGNER_C --salt $SALT \
    -- --account deployer
done
SAFE=0x...   # printed by the script
```

Check both chains:

```bash
for RPC in $RH $ARC; do
  cast call $SAFE "getOwners()(address[])" --rpc-url $RPC
  cast call $SAFE "getThreshold()(uint256)" --rpc-url $RPC   # 2
done
```

Optional: an incident-response guardian that can pause launches and curve buys (never exits or
graduation): `export EMERGENCY_GUARDIAN=0x...`.

## 3. Robinhood Chain stack

Deploys the hook (mined CREATE2 address), graduator, factory (with its curve deployer), router and
buyback. It wires them together and proposes the Safe as owner of the factory, graduator and buyback.

```bash
unset PRIVATE_KEY MNEMONIC
export OWNER_SAFE=$SAFE

# Dry-run: check "Deployer :" = $DEPLOYER and "Fee Recipient:" = $SAFE
forge script script/robinhood/DeployRobinhoodV2.s.sol --fork-url $RH --sender $DEPLOYER

# Broadcast and verify on the explorer
forge script script/robinhood/DeployRobinhoodV2.s.sol --rpc-url $RH \
  --account deployer --sender $DEPLOYER --broadcast --verify $RH_VERIFIER
```

`LaunchpadV2Factory.protocolFeeRecipient` is **immutable**: if the dry-run shows anything other than
the Safe, stop. Record the logged addresses:

```bash
RH_FACTORY=0x...   RH_GRADUATOR=0x...   RH_HOOK=0x...   RH_ROUTER=0x...   RH_BUYBACK=0x...
```

## 4. Arc stack

Deploys the hook, factory, router and buyback, with a 20% protocol cut (`ARC_PROTOCOL_FEE_BPS`).

```bash
forge script script/arc/DeployArc.s.sol --fork-url $ARC --sender $DEPLOYER      # dry-run
forge script script/arc/DeployArc.s.sol --rpc-url $ARC \
  --account deployer --sender $DEPLOYER --broadcast --verify $ARC_VERIFIER
ARC_FACTORY=0x...   ARC_HOOK=0x...   ARC_ROUTER=0x...   ARC_BUYBACK=0x...
```

If verification fails, or the explorer refuses the request (Blockscout sits behind a Cloudflare
check that can turn command-line clients away), verify in the explorer's web UI instead: "Verify &
publish", method "Solidity (Standard JSON input)", with the file from
`forge verify-contract <ADDRESS> <PATH>:<NAME> --show-standard-json-input > input.json` and the
constructor arguments from `cast abi-encode`. See `docs/ARC_DEPLOY.md` ("Source Verification").

## 5. Limit orders and team splitter factory

Both contracts have no owner, and their wiring is fixed at deploy. `DeployLimitOrders` refuses to run
without the addresses on purpose. It picks native ETH on Robinhood Chain, and on Arc USDC with a 1e12
scale.

```bash
CURVE_FACTORY=$RH_FACTORY ROUTER=$RH_ROUTER HOOK=$RH_HOOK \
  forge script script/DeployLimitOrders.s.sol --rpc-url $RH \
  --account deployer --sender $DEPLOYER --broadcast --verify $RH_VERIFIER
ROUTER=$ARC_ROUTER HOOK=$ARC_HOOK \
  forge script script/DeployLimitOrders.s.sol --rpc-url $ARC \
  --account deployer --sender $DEPLOYER --broadcast --verify $ARC_VERIFIER
RH_LIMIT_ORDERS=0x...   ARC_LIMIT_ORDERS=0x...

forge script script/DeployTeamSplitterFactory.s.sol --rpc-url $RH \
  --account deployer --sender $DEPLOYER --broadcast --verify $RH_VERIFIER
forge script script/DeployTeamSplitterFactory.s.sol --rpc-url $ARC \
  --account deployer --sender $DEPLOYER --broadcast --verify $ARC_VERIFIER
RH_TEAM_SPLITTER_FACTORY=0x...   ARC_TEAM_SPLITTER_FACTORY=0x...
```

## 6. Hand ownership to the Safe

The scripts only _propose_ the Safe (two-step ownership). Until the Safe calls `acceptOwnership()`,
the deployer is still the owner. There are five contracts: Robinhood factory, graduator and buyback,
and Arc factory and buyback.

Each Safe transaction commits to the Safe's nonce, so finish one (hash, sign, exec) before you start
the next:

```bash
DATA=$(cast calldata "acceptOwnership()")
# Repeat for: $RH_FACTORY $RH_GRADUATOR $RH_BUYBACK on $RH, then $ARC_FACTORY $ARC_BUYBACK on $ARC
TARGET=$RH_FACTORY RPC=$RH
../scripts/safe/safe-tx.sh hash --rpc-url $RPC --safe $SAFE --to $TARGET --data $DATA
# Each of 2 signers, on their own machine:
../scripts/safe/safe-tx.sh sign --hash 0x... -- --ledger        # prints OWNER:SIGNATURE
# Anyone (pays gas):
../scripts/safe/safe-tx.sh exec --rpc-url $RPC --safe $SAFE --to $TARGET --data $DATA \
  --sig 0xOWNER_A:0xSIG_A --sig 0xOWNER_B:0xSIG_B -- --account deployer
```

## 7. Check the deployment

Every line must print the expected value:

```bash
# Owners: all = $SAFE
for C in $RH_FACTORY $RH_GRADUATOR $RH_BUYBACK; do cast call $C "owner()(address)" --rpc-url $RH; done
for C in $ARC_FACTORY $ARC_BUYBACK; do cast call $C "owner()(address)" --rpc-url $ARC; done

# Robinhood wiring
cast call $RH_FACTORY   "protocolFeeRecipient()(address)" --rpc-url $RH   # $SAFE
cast call $RH_FACTORY   "graduator()(address)"            --rpc-url $RH   # $RH_GRADUATOR
cast call $RH_GRADUATOR "launcher()(address)"             --rpc-url $RH   # $RH_FACTORY
cast call $RH_GRADUATOR "buybackVault()(address)"         --rpc-url $RH   # $RH_BUYBACK
cast call $RH_HOOK      "factory()(address)"              --rpc-url $RH   # $RH_GRADUATOR
cast call $RH_LIMIT_ORDERS "curveFactory()(address)"      --rpc-url $RH   # $RH_FACTORY

# Arc wiring
cast call $ARC_FACTORY "protocolFeeRecipient()(address)" --rpc-url $ARC   # $SAFE
cast call $ARC_FACTORY "buybackVault()(address)"         --rpc-url $ARC   # $ARC_BUYBACK
cast call $ARC_HOOK    "factory()(address)"              --rpc-url $ARC   # $ARC_FACTORY
cast call $ARC_LIMIT_ORDERS "quoteAsset()(address)"      --rpc-url $ARC   # 0x3600…0000
cast call $ARC_LIMIT_ORDERS "nativeScale()(uint256)"     --rpc-url $ARC   # 1000000000000
```

### Verify the first token and curve

Tokens and curves are created by the factory, so the deploy scripts never verify them. All of them
share one bytecode (initializer pattern, no constructor arguments), so verifying the first launch's
token and curve once lets the explorer match every later one. Do it right after the test launch below:

```bash
forge verify-contract <TOKEN> src/core/LaunchpadToken.sol:LaunchpadToken --chain-id 4663 $RH_VERIFIER
forge verify-contract <CURVE> src/core/BondingCurve.sol:BondingCurve   --chain-id 4663 $RH_VERIFIER
forge verify-contract <ARC_TOKEN> src/core/LaunchpadToken.sol:LaunchpadToken --chain-id 5042 $ARC_VERIFIER
```

Check that a second launch then shows as verified without a submission.

Then run one test launch on each chain from the deployer or a scratch wallet: a launch with a tax
and a split, and a buy and a sell. On Robinhood Chain, also check
`token.taxConfig()` and `graduator.hasTokenSplit(token)` right after the launch.

### Optional: Etherscan as well

`robin.etherscan.io` and `arc.etherscan.io` index both chains too. To verify there, rerun
`forge verify-contract <ADDRESS> <PATH>:<NAME> --chain robinhood` (or `--chain arc`) with
`ROBINSCAN_API_KEY` in `contracts/.env`, adding `--constructor-args` where a contract has them.
Etherscan's free plan refuses some endpoints on these chains, so a paid key may be needed.

## 8. Hand off to the app release

Put the addresses into the defaults in `packages/shared-types/src/chains/robinhood.ts` and `arc.ts`
(the env name each one can also be overridden with is in brackets):

| Robinhood Chain             | Field                  | Env override                      |
| --------------------------- | ---------------------- | --------------------------------- |
| `$RH_FACTORY`               | `factory`, `factoryV2` | `ROBINHOOD_FACTORY_V2_ADDRESS`    |
| `$RH_GRADUATOR`             | `graduator`            | `ROBINHOOD_GRADUATOR`             |
| `$RH_HOOK`                  | `memeHook`             | `ROBINHOOD_V4_HOOK`               |
| `$RH_ROUTER`                | `router`               | `ROBINHOOD_V4_ROUTER`             |
| `$RH_BUYBACK`               | `buyback`              | `ROBINHOOD_V4_BUYBACK`            |
| `$RH_LIMIT_ORDERS`          | `limitOrders`          | `ROBINHOOD_LIMIT_ORDERS`          |
| `$RH_TEAM_SPLITTER_FACTORY` | `teamSplitterFactory`  | `ROBINHOOD_TEAM_SPLITTER_FACTORY` |

| Arc                          | Field                  | Env override                |
| ---------------------------- | ---------------------- | --------------------------- |
| `$ARC_FACTORY`               | `factory`, `factoryV2` | `ARC_V4_FACTORY_ADDRESS`    |
| `$ARC_HOOK`                  | `memeHook`             | `ARC_MEME_HOOK`             |
| `$ARC_ROUTER`                | `router`               | `ARC_V4_ROUTER`             |
| `$ARC_BUYBACK`               | `buyback`              | `ARC_V4_BUYBACK`            |
| `$ARC_LIMIT_ORDERS`          | `limitOrders`          | `ARC_LIMIT_ORDERS`          |
| `$ARC_TEAM_SPLITTER_FACTORY` | `teamSplitterFactory`  | `ARC_TEAM_SPLITTER_FACTORY` |

Open a PR with the new defaults (`bun nx run-many -t test typecheck` must pass). Then continue with
sections 4–6 of `docs/RELEASE-REDEPLOY.md`: empty database, then the API and frontend together,
then the smoke checks.

The API keeper key for the release is already prepared on the VPS (`0xBD9b…88E3`, funded with the
old keeper's balance). It starts with the release deploy, which recreates the API container.

## If something goes wrong

- **A dry-run shows the wrong deployer or fee recipient:** stop. Check that `PRIVATE_KEY` is unset and
  that `OWNER_SAFE` / `PROTOCOL_FEE_RECIPIENT` are set as intended.
- **A broadcast fails halfway:** the contracts that were created stay on-chain, unused. Fix the cause
  and re-run the whole script; the hook salt is mined again for the same deployer. Never mix
  addresses from two runs.
- **`acceptOwnership` was not done:** the deployer keeps owner powers. Finish section 6 before the
  release.
