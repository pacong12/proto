#!/usr/bin/env bash
# verify-robinhood.sh
# Verifies the Robinhood Chain (4663) v4 stack deployed by script/robinhood/DeployRobinhoodV2.s.sol.
#
# Usage:
#   bash scripts/verify-robinhood.sh                 # factory, graduator, hook, splitter deployer, router, buyback
#   TOKEN_ADDRESS=0x... CURVE_ADDRESS=0x... bash scripts/verify-robinhood.sh --token
#
# Requires: foundry (forge, cast) and contracts/.env with
#   ETHERSCAN_API_KEY, ROBINHOOD_FACTORY_V2_ADDRESS
# Optional: ROBINHOOD_V4_ROUTER, ROBINHOOD_V4_BUYBACK, ROBINHOOD_RPC_URL.
# Constructor arguments are read back from the deployed contracts, so only the entry points are needed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
fi

: "${ETHERSCAN_API_KEY:?ETHERSCAN_API_KEY not set}"
: "${ROBINHOOD_FACTORY_V2_ADDRESS:?ROBINHOOD_FACTORY_V2_ADDRESS not set}"
RPC_URL="${ROBINHOOD_RPC_URL:-https://rpc.mainnet.chain.robinhood.com}"

VERIFIER_URL="https://api.etherscan.io/v2/api?chainid=4663"
CHAIN_ID=4663

cd "$SCRIPT_DIR/.."

read_addr() { cast call "$1" "$2" --rpc-url "$RPC_URL"; }

verify() {
  local address="$1" contract="$2" args="${3:-}"
  echo "==> Verifying $contract at $address ..."
  local extra=()
  [[ -n "$args" ]] && extra=(--constructor-args "$args")
  forge verify-contract "$address" "$contract" \
    --chain-id "$CHAIN_ID" \
    --verifier-url "$VERIFIER_URL" \
    --etherscan-api-key "$ETHERSCAN_API_KEY" \
    "${extra[@]}" \
    --watch
}

if [[ "${1:-}" == "--token" ]]; then
  # Tokens and curves are CREATE2-deployed without constructor arguments (initializer pattern).
  : "${TOKEN_ADDRESS:?TOKEN_ADDRESS not set}"
  verify "$TOKEN_ADDRESS" src/core/LaunchpadToken.sol:LaunchpadToken
  if [[ -n "${CURVE_ADDRESS:-}" ]]; then
    verify "$CURVE_ADDRESS" src/core/BondingCurve.sol:BondingCurve
  fi
  exit 0
fi

FACTORY="$ROBINHOOD_FACTORY_V2_ADDRESS"
GRADUATOR=$(read_addr "$FACTORY" "graduator()(address)")
FEE_RECIPIENT=$(read_addr "$FACTORY" "protocolFeeRecipient()(address)")
POOL_MANAGER=$(read_addr "$GRADUATOR" "poolManager()(address)")
HOOK=$(read_addr "$GRADUATOR" "hook()(address)")
SPLITTER_DEPLOYER=$(read_addr "$GRADUATOR" "splitterDeployer()(address)")
GRAD_FEE_RECIPIENT=$(read_addr "$GRADUATOR" "protocolFeeRecipient()(address)")
HOOK_DEPLOYER=$(read_addr "$HOOK" "deployer()(address)")
# defaultSplit() returns (protocolBps, holdersBps, burnBps, creatorBps, liquidityBps), one per line.
mapfile -t SPLIT < <(cast call "$GRADUATOR" "defaultSplit()(uint16,uint16,uint16,uint16,uint16)" --rpc-url "$RPC_URL")

verify "$HOOK" src/core/GotonV4Hook.sol:GotonV4Hook \
  "$(cast abi-encode "constructor(address,address)" "$POOL_MANAGER" "$HOOK_DEPLOYER")"

verify "$SPLITTER_DEPLOYER" src/core/GotonFeeSplitter.sol:GotonFeeSplitterDeployer

verify "$GRADUATOR" src/core/GotonV4Graduator.sol:GotonV4Graduator \
  "$(cast abi-encode "constructor(address,address,address,address,(uint16,uint16,uint16,uint16,uint16))" \
    "$POOL_MANAGER" "$HOOK" "$SPLITTER_DEPLOYER" "$GRAD_FEE_RECIPIENT" \
    "(${SPLIT[0]},${SPLIT[1]},${SPLIT[2]},${SPLIT[3]},${SPLIT[4]})")"

verify "$FACTORY" src/chains/robinhood/LaunchpadV2Factory.sol:LaunchpadV2Factory \
  "$(cast abi-encode "constructor(address,address)" "$FEE_RECIPIENT" "$GRADUATOR")"

if [[ -n "${ROBINHOOD_V4_ROUTER:-}" ]]; then
  verify "$ROBINHOOD_V4_ROUTER" src/core/GotonV4Router.sol:GotonV4Router \
    "$(cast abi-encode "constructor(address,address,uint256)" "$POOL_MANAGER" \
      0x0000000000000000000000000000000000000000 0)"
fi

if [[ -n "${ROBINHOOD_V4_BUYBACK:-}" ]]; then
  verify "$ROBINHOOD_V4_BUYBACK" src/core/GotonV4Buyback.sol:GotonV4Buyback \
    "$(cast abi-encode "constructor(address,address)" "$POOL_MANAGER" "$HOOK")"
fi

echo "==> Robinhood v4 stack verified."
