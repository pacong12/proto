#!/usr/bin/env bash
# Proposes, signs and executes a Safe (v1.3+/1.4.1) transaction with cast, no Safe web app needed.
#
# 1. Anyone computes the transaction hash:
#      scripts/safe/safe-tx.sh hash --rpc-url RPC --safe SAFE --to TARGET --data CALLDATA
# 2. Each owner signs that hash on their own machine (Ledger/Trezor/keystore/private key):
#      scripts/safe/safe-tx.sh sign --hash 0x... -- --ledger
#    It prints "OWNER_ADDRESS:SIGNATURE"; send that line to whoever executes.
# 3. Anyone executes once enough owners signed (the executor pays gas, it need not be an owner):
#      scripts/safe/safe-tx.sh exec --rpc-url RPC --safe SAFE --to TARGET --data CALLDATA \
#        --sig 0xOwnerA:0xsig... --sig 0xOwnerB:0xsig... -- --account deployer
#
# Build CALLDATA with cast, e.g.: cast calldata "acceptOwnership()"
# The hash commits to the Safe's current nonce: sign and execute before any other Safe tx.
set -euo pipefail

ZERO=0x0000000000000000000000000000000000000000
cmd="${1:-}"; shift || true

rpc="" safe="" to="" data="0x" value=0 nonce="" hash="" sigs=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --rpc-url) rpc="$2"; shift 2 ;;
    --safe) safe="$2"; shift 2 ;;
    --to) to="$2"; shift 2 ;;
    --data) data="$2"; shift 2 ;;
    --value) value="$2"; shift 2 ;;
    --nonce) nonce="$2"; shift 2 ;;
    --hash) hash="$2"; shift 2 ;;
    --sig) sigs+=("$2"); shift 2 ;;
    --) shift; break ;;
    *) echo "Unknown option $1" >&2; exit 2 ;;
  esac
done
extra=("$@")

tx_hash() {
  local n="${nonce:-$(cast call "$safe" "nonce()(uint256)" --rpc-url "$rpc")}"
  cast call "$safe" \
    "getTransactionHash(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,uint256)(bytes32)" \
    "$to" "$value" "$data" 0 0 0 0 "$ZERO" "$ZERO" "$n" --rpc-url "$rpc"
}

case "$cmd" in
  hash)
    [[ -n "$rpc" && -n "$safe" && -n "$to" ]] || { echo "hash needs --rpc-url --safe --to [--data] [--value]" >&2; exit 2; }
    echo "Safe:   $safe (nonce $(cast call "$safe" "nonce()(uint256)" --rpc-url "$rpc"))"
    echo "Call:   $to value=$value data=$data"
    echo "Hash:   $(tx_hash)"
    ;;
  sign)
    [[ -n "$hash" ]] || { echo "sign needs --hash and signer flags after --" >&2; exit 2; }
    # Signs the raw 32-byte hash (v = 27/28), which Safe verifies with ecrecover.
    sig=$(cast wallet sign --no-hash "$hash" "${extra[@]}")
    addr=$(cast wallet address "${extra[@]}")
    echo "$addr:$sig"
    ;;
  exec)
    [[ -n "$rpc" && -n "$safe" && -n "$to" && ${#sigs[@]} -gt 0 ]] || {
      echo "exec needs --rpc-url --safe --to [--data] --sig ADDR:SIG... -- <cast send signer flags>" >&2; exit 2; }
    threshold=$(cast call "$safe" "getThreshold()(uint256)" --rpc-url "$rpc")
    (( ${#sigs[@]} >= threshold )) || { echo "Need $threshold signatures, have ${#sigs[@]}" >&2; exit 1; }
    expected=$(tx_hash)
    # Safe requires signatures ordered by owner address, ascending.
    packed=0x
    while IFS=: read -r owner sig; do
      recovered=$(cast wallet verify --address "$owner" --no-hash "$expected" "$sig" >/dev/null 2>&1 && echo ok || echo bad)
      [[ "$recovered" == ok ]] || { echo "Signature from $owner does not match hash $expected" >&2; exit 1; }
      packed+="${sig#0x}"
    done < <(printf '%s\n' "${sigs[@]}" | tr 'A-F' 'a-f' | sort)
    cast send "$safe" \
      "execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)" \
      "$to" "$value" "$data" 0 0 0 0 "$ZERO" "$ZERO" "$packed" --rpc-url "$rpc" "${extra[@]}"
    ;;
  *)
    sed -n '2,17p' "$0" >&2
    exit 2
    ;;
esac
