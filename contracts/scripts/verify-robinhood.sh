#!/usr/bin/env bash
# verify-robinhood.sh
# Verifies Proto V2 contracts on RobinScan (Robinhood Chain, chain ID 4663).
# Usage: bash scripts/verify-robinhood.sh
# Requires: foundry (forge), .env in contracts/ dir with ETHERSCAN_API_KEY set.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env not found at $ENV_FILE" >&2
  exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

: "${ETHERSCAN_API_KEY:?ETHERSCAN_API_KEY not set in .env}"
: "${ROBINHOOD_FACTORY_V2_ADDRESS:?ROBINHOOD_FACTORY_V2_ADDRESS not set in .env}"
: "${ROBINHOOD_FEE_RECIPIENT:?ROBINHOOD_FEE_RECIPIENT not set in .env}"
: "${ROBINHOOD_LOCKER_ADDRESS:?ROBINHOOD_LOCKER_ADDRESS not set in .env}"
: "${ROBINHOOD_POOL_MANAGER_V4:?ROBINHOOD_POOL_MANAGER_V4 not set in .env}"
: "${ROBINHOOD_MEME_HOOK:?ROBINHOOD_MEME_HOOK not set in .env}"

VERIFIER_URL="https://api.etherscan.io/v2/api?chainid=4663"
CHAIN_ID=4663

cd "$SCRIPT_DIR/.."

echo "==> Verifying LaunchpadV2Factory at $ROBINHOOD_FACTORY_V2_ADDRESS ..."

CONSTRUCTOR_ARGS=$(cast abi-encode \
  "constructor(address,address,address,address)" \
  "$ROBINHOOD_FEE_RECIPIENT" \
  "$ROBINHOOD_LOCKER_ADDRESS" \
  "$ROBINHOOD_POOL_MANAGER_V4" \
  "$ROBINHOOD_MEME_HOOK")

forge verify-contract \
  "$ROBINHOOD_FACTORY_V2_ADDRESS" \
  src/LaunchpadV2Factory.sol:LaunchpadV2Factory \
  --chain-id "$CHAIN_ID" \
  --verifier-url "$VERIFIER_URL" \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  --constructor-args "$CONSTRUCTOR_ARGS" \
  --watch

echo "==> LaunchpadV2Factory verified."

# ---------------------------------------------------------------------------
# Token contracts are deployed by the factory at runtime — verify by
# providing the same bytecode + constructor args used during launch.
# Pass TOKEN_ADDRESS and TOKEN_CONSTRUCTOR_ARGS as env vars for one-off runs:
#   TOKEN_ADDRESS=0x66c1c2b5... \
#   TOKEN_NAME="TEST" TOKEN_SYMBOL="TEST" \
#   bash scripts/verify-robinhood.sh --token
# ---------------------------------------------------------------------------
if [[ "${1:-}" == "--token" ]]; then
  : "${TOKEN_ADDRESS:?TOKEN_ADDRESS not set}"
  : "${TOKEN_NAME:?TOKEN_NAME not set}"
  : "${TOKEN_SYMBOL:?TOKEN_SYMBOL not set}"
  : "${TOKEN_LOGO:=${TOKEN_LOGO:-}}"
  : "${TOKEN_DESCRIPTION:=${TOKEN_DESCRIPTION:-}}"
  : "${TOKEN_DEPLOYER:?TOKEN_DEPLOYER not set}"
  : "${TOKEN_CURVE:?TOKEN_CURVE not set}"
  : "${TOKEN_SUPPLY:=${TOKEN_SUPPLY:-1000000000000000000000000000}}"

  echo "==> Verifying LaunchpadToken at $TOKEN_ADDRESS ..."

  TOKEN_CONSTRUCTOR_ARGS=$(cast abi-encode \
    "constructor(string,string,string,string,(string,string,string,string,string),address,address,address,uint256)" \
    "$TOKEN_NAME" \
    "$TOKEN_SYMBOL" \
    "${TOKEN_LOGO:-}" \
    "${TOKEN_DESCRIPTION:-}" \
    "($TWITTER,$TELEGRAM,$DISCORD,$WEBSITE,$FARCASTER)" \
    "$TOKEN_DEPLOYER" \
    "$TOKEN_CURVE" \
    "$ROBINHOOD_FACTORY_V2_ADDRESS" \
    "$TOKEN_SUPPLY")

  forge verify-contract \
    "$TOKEN_ADDRESS" \
    src/LaunchpadToken.sol:LaunchpadToken \
    --chain-id "$CHAIN_ID" \
    --verifier-url "$VERIFIER_URL" \
    --etherscan-api-key "$ETHERSCAN_API_KEY" \
    --constructor-args "$TOKEN_CONSTRUCTOR_ARGS" \
    --watch

  echo "==> LaunchpadToken $TOKEN_ADDRESS verified."
fi
