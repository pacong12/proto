#!/usr/bin/env bash
# Creates a Safe multisig (v1.4.1, canonical deployment) with cast, no Safe web app needed.
#
#   scripts/safe/create-safe.sh --rpc-url <RPC> --threshold 2 \
#     --owner 0xA... --owner 0xB... --owner 0xC... [--salt 1] -- <cast send signer flags>
#
# Everything after `--` is passed to `cast send` to pick the account that pays gas, e.g.
# `--account deployer` (keystore), `--ledger`, or `--private-key $KEY`. That account does not
# become an owner. The script prints the new Safe address, then checks owners and threshold.
set -euo pipefail

SAFE_L2_SINGLETON=0x29fcB43b46531BcA003ddC8FCB67FFE91900C762
PROXY_FACTORY=0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67
FALLBACK_HANDLER=0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99
ZERO=0x0000000000000000000000000000000000000000

rpc="" threshold="" salt="$(date +%s)" owners=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --rpc-url) rpc="$2"; shift 2 ;;
    --threshold) threshold="$2"; shift 2 ;;
    --owner) owners+=("$2"); shift 2 ;;
    --salt) salt="$2"; shift 2 ;;
    --) shift; break ;;
    *) echo "Unknown option $1" >&2; exit 2 ;;
  esac
done
signer=("$@")

[[ -n "$rpc" && -n "$threshold" && ${#owners[@]} -gt 0 ]] || {
  echo "Usage: $0 --rpc-url RPC --threshold N --owner ADDR [--owner ADDR...] [--salt N] -- <signer flags>" >&2
  exit 2
}
(( threshold >= 1 && threshold <= ${#owners[@]} )) || { echo "Threshold must be 1..${#owners[@]}" >&2; exit 2; }
(( ${#owners[@]} >= 2 && threshold >= 2 )) || echo "Warning: a 1-of-N Safe protects nothing a single key does not." >&2

for c in "$SAFE_L2_SINGLETON" "$PROXY_FACTORY" "$FALLBACK_HANDLER"; do
  [[ "$(cast code "$c" --rpc-url "$rpc")" != "0x" ]] || { echo "Safe contract $c is not deployed on this chain" >&2; exit 1; }
done

owner_list="[$(IFS=,; echo "${owners[*]}")]"
initializer=$(cast calldata \
  "setup(address[],uint256,address,bytes,address,address,uint256,address)" \
  "$owner_list" "$threshold" "$ZERO" 0x "$FALLBACK_HANDLER" "$ZERO" 0 "$ZERO")

# The proxy address is deterministic; simulate first to learn it, then send.
safe=$(cast call "$PROXY_FACTORY" "createProxyWithNonce(address,bytes,uint256)(address)" \
  "$SAFE_L2_SINGLETON" "$initializer" "$salt" --rpc-url "$rpc")
echo "Creating Safe $safe (chain $(cast chain-id --rpc-url "$rpc"), ${threshold}-of-${#owners[@]})"

cast send "$PROXY_FACTORY" "createProxyWithNonce(address,bytes,uint256)" \
  "$SAFE_L2_SINGLETON" "$initializer" "$salt" --rpc-url "$rpc" "${signer[@]}" >/dev/null

echo "Owners:    $(cast call "$safe" "getOwners()(address[])" --rpc-url "$rpc")"
echo "Threshold: $(cast call "$safe" "getThreshold()(uint256)" --rpc-url "$rpc")"
echo "SAFE=$safe"
