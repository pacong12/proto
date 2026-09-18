# Arc Network Deployment Guide

## Contracts to Deploy

### 1. LaunchpadV2FactoryArc (`contracts/src/LaunchpadV2FactoryArc.sol`)

Arc Standard constants:

- Launch fee: `1.00 USDC` (1 ether in native 18-decimal msg.value)
- Opening FDV: `$4,200 USDC` (virtualUsdcReserve = 4,200 ether)
- Graduation target: `$69,000 USDC` (69,000 ether)
- Virtual token reserve: `1,000,000,000 * 1e18`
- Spot price at launch: `4,200e18 * 1e18 / 1,000,000,000e18 = 4.2e12 wei = $0.0000042`

### 2. LiquidityLocker (`contracts/src/LiquidityLocker.sol`)

Required constructor args:

- `positionManager`: `0x39654A85A4C05127f5Fd6ED22CAeC077A0fB1377`
- `weth`: `0x3600000000000000000000000000000000000000` (native USDC on Arc)
- `protocolFeeRecipient`: `0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2`

---

## Pre-deployment Requirements

```bash
# 1. Install Foundry
curl -L https://foundry.paradigm.xyz | bash && foundryup

# 2. Build contracts
cd contracts && forge build

# 3. Run tests (must all pass before deploying)
forge test
```

---

## Deploy to Arc Mainnet (Chain ID: 5042)

```bash
cd contracts

# Option A: using PRIVATE_KEY env var
PRIVATE_KEY=<your-hex-key> \
forge script script/DeployArc.s.sol \
  --rpc-url https://rpc.mainnet.arc.io \
  --broadcast \
  --verify \
  --verifier blockscout \
  --verifier-url https://explorer.arc.io/api

# Option B: using MNEMONIC env var
MNEMONIC="word1 word2 ... word12" \
forge script script/DeployArc.s.sol \
  --rpc-url https://rpc.mainnet.arc.io \
  --broadcast

# Option C: dry-run (no broadcast)
PRIVATE_KEY=<your-hex-key> \
forge script script/DeployArc.s.sol \
  --rpc-url https://rpc.mainnet.arc.io
```

Optional env overrides:

```bash
PROTOCOL_FEE_RECIPIENT=0x...   # default: 0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2
LIQUIDITY_LOCKER_ADDRESS=0x... # skip LiquidityLocker deploy, reuse existing
POSITION_MANAGER=0x...         # default: 0x39654A85A4C05127f5Fd6ED22CAeC077A0fB1377
WETH_ADDRESS=0x...             # default: 0x3600000000000000000000000000000000000000
```

---

## Post-deployment Checklist

After a successful broadcast, `forge script` prints the deployed addresses.
Update the following files with the new addresses:

### `packages/shared-types/src/constants/network.ts`

```typescript
export const ARC_CHAIN: NetworkConfig = {
  contracts: {
    factory: '<NEW_FACTORY_ADDRESS>',
    factoryV2: '<NEW_FACTORY_ADDRESS>',
    locker: '<NEW_LOCKER_ADDRESS>',
    // ... rest unchanged
  },
};
```

### `.env` (API server)

```bash
ARC_FACTORY_ADDRESS=<NEW_FACTORY_ADDRESS>
ARC_LOCKER_ADDRESS=<NEW_LOCKER_ADDRESS>
```

---

## Source Verification

```bash
# Verify LaunchpadV2FactoryArc on Arc Explorer
forge verify-contract <FACTORY_ADDRESS> \
  contracts/src/LaunchpadV2FactoryArc.sol:LaunchpadV2FactoryArc \
  --rpc-url https://rpc.mainnet.arc.io \
  --verifier blockscout \
  --verifier-url https://explorer.arc.io/api \
  --constructor-args $(cast abi-encode \
    "constructor(address,address,address,address)" \
    "0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2" \
    "<LOCKER_ADDRESS>" \
    "0x0000000000000000000000000000000000000000" \
    "0x0000000000000000000000000000000000000000")
```

---

## Validate On-chain Constants After Deploy

```bash
cast call <FACTORY_ADDRESS> "launchFee()(uint256)" --rpc-url https://rpc.mainnet.arc.io
# Expected: 1000000000000000000 (1.00 USDC in 18-decimal wei)

cast call <FACTORY_ADDRESS> "GRADUATION_TARGET()(uint256)" --rpc-url https://rpc.mainnet.arc.io
# Expected: 69000000000000000000000 (69,000 USDC)

cast call <FACTORY_ADDRESS> "VIRTUAL_USDC_RESERVE()(uint256)" --rpc-url https://rpc.mainnet.arc.io
# Expected: 4200000000000000000000 (4,200 USDC)

cast call <FACTORY_ADDRESS> "VIRTUAL_TOKEN_RESERVE()(uint256)" --rpc-url https://rpc.mainnet.arc.io
# Expected: 1000000000000000000000000000 (1 billion tokens)
```

---

## Known Pending Items

| Item                          | Status  | Notes                                          |
| ----------------------------- | ------- | ---------------------------------------------- |
| LaunchpadV2FactoryArc deploy  | Pending | Fund deployer wallet first                     |
| LiquidityLocker deploy        | Pending | Deployed alongside factory                     |
| quoterV2 address verification | Pending | Confirm `0x33e885eD0...` is correct            |
| Explorer source verification  | Pending | After deploy                                   |
| network.ts contract addresses | Pending | After deploy                                   |
| DEX Screener registration     | Pending | Email partners@dexscreener.com                 |
| GeckoTerminal registration    | Pending | Form at geckoterminal.com/new-network-requests |
