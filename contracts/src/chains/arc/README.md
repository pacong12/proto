# Arc Network Architecture (Chain ID: 5042)

## 1. Network Overview

- **Network Name**: Arc Network
- **Chain ID**: 5042
- **Network Type**: Circle Stablecoin Layer 1
- **Native Gas Asset**: USD Coin (USDC) with 18 decimals in `msg.value` (1 ether = 1.00 USDC)
- **RPC Endpoint**: `https://rpc.mainnet.arc.io` (Fallbacks: `https://rpc.blockdaemon.mainnet.arc.io`, `https://arc.drpc.org`)
- **Block Explorer**: `https://explorer.arc.io`

---

## 2. Bonding Curve Mathematics & Tokenomics

- **Total Supply**: 1,000,000,000 tokens (fixed supply, 18 decimals)
- **Curve Allocation**: 738,600,000 tokens (73.86%, Argus standard)
- **Pool Reserve Supply**: 261,400,000 tokens (26.14%, Argus standard)
- **Initial Virtual USDC Reserve**: 24,420 USDC (`24_420 ether`)
- **Graduation Target**: 69,000 USDC (`69_000 ether`)
- **Opening Spot Price**: 24,420 / 1,000,000,000 = `$0.00002442` USDC
- **Opening FDV**: $24,420 USD
- **Graduation FDV**: ~$357,383 USD

---

## 3. Sovereign Smart Contract Infrastructure

Proto maintains 100% sovereign ownership over its protocol contracts on Arc Network:

- **Factory V2 Contract**: `LaunchpadV2FactoryArc.sol` (`0xf94d16c9E90fCd55b75D318d0104269146612abF`)
- **Liquidity Locker**: `LiquidityLocker.sol` (`0x173FF5D4eF626869a5a35FF0EA0c56c0A7e4Cd8b`)
- **Protocol Fee Recipient**: `0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2`

---

## 4. DEX Graduation & Post-Graduation Routing

- **Canonical DEX**: Uniswap V3 on Arc Network (Uniswap V4 is not present on Arc)
- **Uniswap V3 Factory**: `0xf0db7b58379503491d857dB50AC9ece64c653918`
- **NonfungiblePositionManager**: `0x39654A85A4C05127f5Fd6ED22CAeC077A0fB1377`
- **SwapRouter**: `0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77`
- **QuoterV2**: `0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7`
- **WETH / Native USDC Address**: `0x3600000000000000000000000000000000000000`
- **Graduation Flow**:
  1. Once total raised USDC reaches 69,000 USDC, bonding curve transitions to `graduated = true`.
  2. Factory calls `migrateCurve(curve, recipient)`:
     - 69,000 USDC and 261,400,000 tokens are migrated to liquidity locker.
     - Liquidity is deposited into full-range Uniswap V3 position with fee tier `10000` (1.00%).
     - The minted NFT position is locked into `LiquidityLocker.sol`.
  3. Post-graduation trades are executed via Uniswap V3 SwapRouter (`0x53BF...6F77`).
