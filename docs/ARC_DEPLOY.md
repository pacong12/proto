# Arc Network Deployment Guide

Arc launches use the **in-pool Uniswap v4 model** (Argus portal parameters). There is no bonding-curve
contract, no liquidity migration and no Uniswap V3 dependency.

## Contracts to Deploy

| Contract                   | Source                                               | Notes                                                                     |
| :------------------------- | :--------------------------------------------------- | :------------------------------------------------------------------------ |
| `ProtoV4Hook`              | `contracts/src/core/ProtoV4Hook.sol`                 | Singleton v4 hook; CREATE2 address must end in permission bits `0x20CC`.  |
| `ProtoFeeSplitterDeployer` | `contracts/src/core/ProtoFeeSplitter.sol`            | Deploys one `ProtoFeeSplitter` per token (keeps the factory under 24 KB). |
| `LaunchpadV2FactoryArc`    | `contracts/src/chains/arc/LaunchpadV2FactoryArc.sol` | Launch portal; owns every launch position (liquidity locked forever).     |

External dependencies (Arc mainnet): Uniswap v4 PoolManager `0x8366a39CC670B4001A1121B8F6A443A643e40951`,
Universal Router `0x4fcA4a51Ab4F23A7447b3284fBd7D73289A89Fb1`, Permit2 `0x000000000022D473030F116dDEE9F6B43aC78BA3`,
USDC `0x3600000000000000000000000000000000000000` (6-decimal ERC-20 view of native USDC).

### Launch parameters (factory defaults, owner-tunable via `setLaunchParams`)

| Parameter       | Value                                   | Meaning                                                    |
| :-------------- | :-------------------------------------- | :--------------------------------------------------------- |
| Pool            | USDC/token, fee 1% (10000), spacing 200 | Same pool shape as Argus                                   |
| Opening tick    | `405400`                                | Opening market cap ≈ $2,480.74                             |
| Bond tick       | `376400`                                | Graduation at ≈ $45,078.87 market cap (~8,094 USDC bought) |
| Liquidity range | `[-887200, 405400]`, 100% of supply     | Mirrored to `[-405400, 887200]` when the token sorts first |
| Min prebuy      | 4.50 USDC                               | Mandatory creator buy, atomic with the launch              |
| Max dev buy     | 5% of supply                            | Launch reverts above this                                  |
| Launch fee      | 0                                       |                                                            |
| Token tax       | 0–10% buy / sell, at least one > 0      | Fixed forever, charged in USDC by the hook                 |
| Protocol cut    | 30% of every tax payment                | Remainder split holders / burn / creator / liquidity       |
| Anti-snipe      | 99% → 25% → 3% → 0 over 3 seconds       | Not applied to the creator prebuy                          |

## Pre-deployment Requirements

```bash
# 1. Install Foundry
curl -L https://foundry.paradigm.xyz | bash && foundryup

# 2. Build contracts
cd contracts && forge build

# 3. Run tests (unit + Arc mainnet fork; all must pass)
forge test
ARC_RPC_URL=https://rpc.mainnet.arc.io forge test --match-path "test/arc/*"
```

The fork suite runs against the real PoolManager, USDC, Permit2 and Universal Router. Arc's USDC calls
native precompiles (`0x1800…00` transfer, `0x1800…01` blocklist) that Foundry cannot execute, so the
test etches equivalent stand-ins at those addresses.

## Deploy to Arc Mainnet (Chain ID: 5042)

```bash
cd contracts

# Dry-run on a fork first (mines the hook salt, no broadcast)
forge script script/arc/DeployArc.s.sol --fork-url https://rpc.mainnet.arc.io --sender <DEPLOYER>

# Broadcast
PRIVATE_KEY=<hex> forge script script/arc/DeployArc.s.sol \
  --rpc-url https://rpc.mainnet.arc.io \
  --broadcast
```

Optional env overrides: `MNEMONIC`, `PROTOCOL_FEE_RECIPIENT` (treasury; also the default buyback and
liquidity vault), `ARC_POOL_MANAGER_V4`, `ARC_USDC`, `EMERGENCY_GUARDIAN` (incident-response multisig
that may call `pause()`; only the owner can `unpause()`. Pausing stops launches, never exits). The hook is deployed through the deterministic
CREATE2 deployer `0x4e59b44847b379578588920cA78FbF26c0B4956C`, and the salt depends on the deployer
address, so always mine and broadcast with the same key.

## Post-deployment Checklist

1. `factory.setRecipients(treasury, buybackVault, liquidityVault)` if the burn / liquidity shares should
   not go to the treasury.
2. Set the new addresses for the apps (the legacy `ARC_FACTORY_ADDRESS`, `ARC_FACTORY_V2_ADDRESS`,
   `ARC_LOCKER_ADDRESS`, `ARC_SWAP_ROUTER`, `ARC_POSITION_MANAGER`, `ARC_QUOTER_V2`, `ARC_V3_FACTORY`,
   `ARC_GRADUATION_*` and `ARC_LAUNCH_FEE_WEI` keys are no longer read):

   ```bash
   ARC_V4_FACTORY_ADDRESS=0x...   # LaunchpadV2FactoryArc
   ARC_MEME_HOOK=0x...            # ProtoV4Hook
   ARC_V4_ROUTER=0x...            # ProtoV4Router (frontend swaps)
   ARC_V4_BUYBACK=0x...           # ProtoV4Buyback (TWAP-guarded buyback-and-burn)
   ```

3. Update `packages/shared-types/src/chains/arc.ts` fallbacks once the addresses are final.

## API Services

- `SESSION_SECRET` — HMAC key for wallet sessions (likes, reposts, votes, profile edits). Without it
  sessions only last until the API restarts.
- `KEEPER_PRIVATE_KEY` — enables the buyback keeper (every `BUYBACK_KEEPER_INTERVAL_MS`, default
  10 min). The key only pays gas: `ProtoV4Buyback` enforces the TWAP guard itself, so the keeper can
  never choose a price. Each token needs ~30 min of trading history before its first buyback.
- `INDEXER_CONFIRMATIONS` — blocks the indexer stays behind the head (default 2).
- `TRUST_PROXY=true` — only when the API is reachable exclusively through Cloudflare / a reverse proxy.
- `REDIS_PASSWORD` — required by `docker-compose.yml` (no default). Generate with `openssl rand -hex 32`.
- `DB_BACKUP_INTERVAL_MS` / `DB_BACKUP_KEEP` — hot SQLite backups into `data/backups` (default daily,
  keep 7; `0` disables). A corrupt database is moved aside at startup and the newest healthy backup is
  restored automatically. Copy `data/backups` off the host for real disaster recovery.
- Re-index a block range after data loss:
  `bun run --env-file=.env scripts/backfill-tokens.ts --chain arc --from <block>`.

## Source Verification

```bash
forge verify-contract <HOOK_ADDRESS> \
  src/core/ProtoV4Hook.sol:ProtoV4Hook \
  --chain-id 5042 --verifier-url "https://api.etherscan.io/v2/api?chainid=5042" \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  --constructor-args $(cast abi-encode "constructor(address,address)" <POOL_MANAGER> <DEPLOYER>)

forge verify-contract <FACTORY_ADDRESS> \
  src/chains/arc/LaunchpadV2FactoryArc.sol:LaunchpadV2FactoryArc \
  --chain-id 5042 --verifier-url "https://api.etherscan.io/v2/api?chainid=5042" \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  --constructor-args $(cast abi-encode "constructor(address,address,address,address,address)" \
    <POOL_MANAGER> <USDC> <HOOK_ADDRESS> <SPLITTER_DEPLOYER> <FEE_RECIPIENT>)
```

## Validate On-chain State After Deploy

```bash
RPC=https://rpc.mainnet.arc.io
cast call <FACTORY_ADDRESS> "initialTick()(int24)" --rpc-url $RPC     # 405400
cast call <FACTORY_ADDRESS> "bondTick()(int24)" --rpc-url $RPC        # 376400
cast call <FACTORY_ADDRESS> "minPrebuyUsdc6()(uint256)" --rpc-url $RPC # 4500000
cast call <FACTORY_ADDRESS> "launchFee()(uint256)" --rpc-url $RPC      # 0
cast call <HOOK_ADDRESS> "factory()(address)" --rpc-url $RPC           # <FACTORY_ADDRESS>
```

## Legacy Deployment

The previous bonding-curve factory `0xf94d16c9E90fCd55b75D318d0104269146612abF` (V3 `LiquidityLocker`
`0x173FF5D4eF626869a5a35FF0EA0c56c0A7e4Cd8b`) stays on-chain with its existing launches; its source is no
longer in this repository's Arc module. Tokens launched there still resolve to Arc via `knownAddresses`.
