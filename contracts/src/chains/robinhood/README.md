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

## 3. Contracts

- **`LaunchpadV2Factory.sol`** (this folder) — bonding-curve launches; permissionless `graduate(token)`.
- Shared (`../../core/`): `BondingCurve.sol`, `LaunchpadToken.sol`, **`ProtoV4Graduator.sol`**,
  **`ProtoV4Hook.sol`**, **`ProtoFeeSplitter.sol`**, **`ProtoV4Router.sol`**.
- Legacy (`../../legacy/`): `ProtoLiquidityLockerV4.sol` (`0x7A1A…D63E`) and `ProtoMemeHook.sol`
  (`0x6347…D9a7`). The deployed hook has invalid v4 permission bits (`0x19A7`), so no pool could be
  initialized with it; the locker never held a position. Both are superseded.
- **Protocol Fee Recipient**: `0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2`

---

## 4. Graduation into Uniswap v4

- **Uniswap v4 PoolManager**: `0x8366a39CC670B4001A1121B8F6A443A643e40951` (same bytecode as Arc)
- **Pool**: native ETH (currency0) / token, 1% fee, tick spacing 200, hook `ProtoV4Hook`.
- **Flow**:
  1. The curve graduates once 4.20 ETH is raised; funds stay in the curve.
  2. Anyone calls `LaunchpadV2Factory.graduate(token)` (the frontend does it automatically before the
     first post-graduation trade). There is no owner-chosen recipient.
  3. `ProtoV4Graduator` initializes the pool at the curve's final price (the hook only lets the
     graduator initialize, so nobody can front-run it), adds all ETH plus matching tokens as a
     full-range position, and places the unpaired tokens as a token-only position just below the
     price. Nothing is burned and the price is continuous across graduation.
  4. Positions are owned by the graduator forever. `collectFees(token)` (permissionless) sends ETH fees
     to the token's `ProtoFeeSplitter` (default 30% protocol / 70% creator) and burns token fees.
  5. Post-graduation trades go through `ProtoV4Router` (native ETH buys, exact-approval sells).
  6. The creator may fix the LP-fee split once, before any third-party buy
     (`ProtoV4Graduator.setRevenueSplit`). The burn share is spent by `ProtoV4Buyback`, which buys
     the token at the hook's TWAP ± 2% and sends it to 0xdEaD.
- Deployment: `contracts/script/robinhood/DeployRobinhoodV2.s.sol`; fork tests:
  `ROBINHOOD_RPC_URL=… forge test --match-path test/robinhood/RobinhoodV4Graduation.fork.t.sol`.
