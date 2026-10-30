#!/usr/bin/env bash
# verify-sourcify.sh
# Verifies one deployed contract on Sourcify (API v2). Blockscout explorers (Robinhood Chain, Arc)
# import Sourcify results, and later contracts with identical bytecode — every token and curve the
# same factory creates — show as "verified via similar contract" without another submission.
#
# Usage:
#   bash scripts/verify-sourcify.sh <chainId> <address> <path:Contract> [commit]
#
#   bash scripts/verify-sourcify.sh 4663 0xToken src/core/LaunchpadToken.sol:LaunchpadToken
#   bash scripts/verify-sourcify.sh 4663 0xCurve src/core/BondingCurve.sol:BondingCurve
#   bash scripts/verify-sourcify.sh 4663 0xOld   src/core/LaunchpadToken.sol:LaunchpadToken a99b3fe
#
# Without a commit the current checkout is compiled, so run it from the commit the contracts were
# deployed from. With one, that commit is checked out in a temporary worktree (the commit of a
# broadcast is in broadcast/<script>/<chainId>/run-*.json). Constructor arguments are not needed:
# Sourcify reads them from the creation transaction.
#
# Requires: foundry (forge), curl, python3. No API key.

set -euo pipefail

if [[ $# -lt 3 ]]; then
  sed -n '7,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit 64
fi

CHAIN_ID="$1" ADDRESS="$2" CONTRACT="$3" COMMIT="${4:-}"
SOURCIFY="${SOURCIFY_URL:-https://sourcify.dev/server}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TMP="$(mktemp -d)"

cleanup() {
  if [[ -n "$COMMIT" && -d "$TMP/worktree" ]]; then
    git -C "$CONTRACTS_DIR" worktree remove --force "$TMP/worktree" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT

# foundry.toml names explorer keys; they are only parsed here, never sent.
export ROBINSCAN_API_KEY="${ROBINSCAN_API_KEY:-unused}" ETHERSCAN_API_KEY="${ETHERSCAN_API_KEY:-unused}"

BUILD_DIR="$CONTRACTS_DIR"
if [[ -n "$COMMIT" ]]; then
  git -C "$CONTRACTS_DIR" worktree add --quiet --detach "$TMP/worktree" "$COMMIT"
  BUILD_DIR="$TMP/worktree/contracts"
  [[ -e "$BUILD_DIR/lib" ]] || ln -s "$CONTRACTS_DIR/lib" "$BUILD_DIR/lib"
fi

(cd "$BUILD_DIR" && forge verify-contract "$ADDRESS" "$CONTRACT" --chain "$CHAIN_ID" \
  --show-standard-json-input >"$TMP/input.json")

python3 - "$TMP/input.json" "$CONTRACT" "$BUILD_DIR" >"$TMP/request.json" <<'EOF'
import json, re, subprocess, sys
std_input = json.load(open(sys.argv[1]))
# forge prints the solc it would use; fall back to the version foundry.toml pins.
out = subprocess.run(["forge", "config", "--json"], cwd=sys.argv[3], capture_output=True, text=True)
solc = json.loads(out.stdout or "{}").get("solc") or json.loads(out.stdout or "{}").get("solc_version") or ""
version = re.sub(r"^v", "", str(solc)) or "0.8.24"
print(json.dumps({"stdJsonInput": std_input, "compilerVersion": version, "contractIdentifier": sys.argv[2]}))
EOF

# Sourcify wants the full version string (0.8.24+commit.e11b9ed9).
VERSION=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['compilerVersion'])" "$TMP/request.json")
if [[ "$VERSION" != *+commit.* ]]; then
  LONG=$(curl -fsS https://binaries.soliditylang.org/linux-amd64/list.json |
    python3 -c "import json,sys; print(json.load(sys.stdin)['releases'].get(sys.argv[1], '').removeprefix('solc-linux-amd64-v'))" "$VERSION")
  [[ -n "$LONG" ]] || { echo "Unknown solc version $VERSION" >&2; exit 1; }
  python3 - "$TMP/request.json" "$LONG" <<'EOF'
import json, sys
request = json.load(open(sys.argv[1]))
request["compilerVersion"] = sys.argv[2]
json.dump(request, open(sys.argv[1], "w"))
EOF
fi

RESPONSE=$(curl -sS -X POST "$SOURCIFY/v2/verify/$CHAIN_ID/$ADDRESS" \
  -H 'content-type: application/json' --data @"$TMP/request.json")
JOB=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('verificationId', ''))" "$RESPONSE" 2>/dev/null || true)
if [[ -z "$JOB" ]]; then
  # Already verified contracts are answered with an error code instead of a job.
  echo "$CHAIN_ID $ADDRESS $CONTRACT: ${RESPONSE:0:300}"
  [[ "$RESPONSE" == *already_verified* ]] && exit 0
  exit 1
fi

for _ in $(seq 1 60); do
  STATUS=$(curl -sS "$SOURCIFY/v2/verify/$JOB")
  [[ "$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('isJobCompleted'))" "$STATUS")" == "True" ]] && break
  sleep 5
done

python3 - "$STATUS" "$CHAIN_ID" "$ADDRESS" "$CONTRACT" <<'EOF'
import json, sys
status, chain, address, contract = json.loads(sys.argv[1]), *sys.argv[2:]
match = (status.get("contract") or {}).get("match")
error = status.get("error") or {}
print(chain, address, contract.split(":")[-1], match or "FAILED", error.get("customCode") or "",
      (error.get("message") or "")[:200])
sys.exit(0 if match else 1)
EOF
