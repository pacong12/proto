# Robinhood Chain Architecture (Chain ID: 4663)

## 1. Network Overview

- **Network Name**: Robinhood Chain
- **Chain ID**: 4663
- **Network Type**: EVM Layer 2 powered by Arbitrum Nitro stack
- **Native Gas Asset**: Ether (ETH) with 18 decimals in `msg.value`
- **RPC Endpoint**: `https://rpc.mainnet.chain.robinhood.com`
- **Block Explorer**: `https://robinhoodchain.blockscout.com`

---

## 2. Bonding Curve Mathematics & Tokenomics

- **Total Supply**: 1,000,000,000 tokens (fixed supply, 18 decimals)
- **Curve Allocation**: 714,285,714 tokens (71.43%, 5/7 mathematical model)
- **Pool Reserve Supply**: 285,714,286 tokens (28.57%, 2/7 mathematical model)
- **Initial Virtual ETH Reserve**: 1.68 ETH (`1_680_000_000_000_000_000` wei)
- **Graduation Target**: 4.20 ETH (`4_200_000_000_000_000_000` wei)
- **Opening Spot Price**: 1.68 / 1,000,000,000 = `0.00000000168` ETH (~$0.00000437 USD at $2,600/ETH)
- **Opening FDV**: 1.68 ETH (~$4,368 USD)
- **Graduation FDV**: ~~20.58 ETH (~~$53,508 USD)

---

## 3. Sovereign Smart Contract Infrastructure

Proto maintains 100% sovereign ownership over its protocol contracts on Robinhood Chain:

- **Factory V2 Contract**: `LaunchpadV2Factory.sol` (`0x9f1fAf78adE92C994AB188452338b45c52800748`)
- **Liquidity Locker V4**: `ProtoLiquidityLockerV4.sol` (`0x7A1AD6AD30B1c9e276eD80a853E8dA897fE5D63E`)
- **Proto MemeHook V4**: `ProtoMemeHook.sol` (`0x6347Ee4710cBCBafa2ED1e837eDc7605cB80D9a7`)
- **Protocol Fee Recipient**: `0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2`

---

## 4. DEX Graduation & Post-Graduation Routing

- **Canonical DEX**: Uniswap V3 on Robinhood Chain
- **Uniswap V3 Factory**: `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA`
- **NonfungiblePositionManager**: `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3`
- **SwapRouter**: `0xCaf681a66D020601342297493863E78C959E5cb2`
- **QuoterV2**: `0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7`
- **WETH Address**: `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`
- **Graduation Flow**:
  1. Once total raised ETH reaches 4.20 ETH, bonding curve transitions to `graduated = true`.
  2. Factory calls `migrateCurve(curve, recipient)`:
     - 4.20 ETH and 285,714,286 tokens are migrated to liquidity locker.
     - Liquidity is deposited into full-range Uniswap V3 position.
     - The minted NFT position is locked into `LiquidityLocker.sol`.
  3. Post-graduation trades are executed via Uniswap V3 SwapRouter (`0xCaf6...5cb2`).
