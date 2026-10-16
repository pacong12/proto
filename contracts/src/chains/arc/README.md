# Arc Network Architecture (Chain ID: 5042)

## 1. Network Overview

- **Network Name**: Arc Network
- **Chain ID**: 5042
- **Network Type**: Circle Stablecoin Layer 1
- **Native Gas Asset**: USDC with 18 decimals in `msg.value` (1 ether = 1.00 USDC); the same balance is
  exposed as a 6-decimal ERC-20 at `0x3600000000000000000000000000000000000000`
- **RPC Endpoint**: `https://rpc.mainnet.arc.io` (Fallbacks: `https://rpc.blockdaemon.mainnet.arc.io`, `https://arc.drpc.org`)
- **Block Explorer**: `https://explorer.arc.io`

---

## 2. Launch Model: In-Pool Uniswap v4 (Argus portal parameters)

Tokens trade in their Uniswap v4 pool from the first block. There is no bonding-curve contract, no
migration and no Uniswap V3 dependency (V3 is deployed on Arc, but Proto does not use it).

1. `LaunchpadV2FactoryArc.launchToken` deploys the token and initializes a USDC/token pool
   (fee 1%, tickSpacing 200, hook `GotonV4Hook`) at tick 405400 (≈ $2,480.74 market cap).
2. 100% of supply is added as single-sided liquidity over `[-887200, 405400]` (mirrored when the token
   sorts before USDC). The position is owned by the factory, which cannot remove it: locked forever.
3. The creator's prebuy (≥ 4.50 USDC, ≤ 5% of supply) is swapped in the same transaction.
4. Graduation is in place: the hook flips `bonded` to false once price crosses bond tick 376400
   (≈ $45,078.87 market cap, ~8,094 USDC bought). Trading continues in the same pool.

Equivalent constant-product reserves of the launch position: 2,480.744058 USDC virtual / 1,000,000,000
tokens (liquidity `1575037795897358225`, identical to Argus pools on-chain).

---

## 3. Contracts

- **`LaunchpadV2FactoryArc.sol`** (this folder) — launch portal and owner of every launch position;
  `collectFees(token)` routes LP fees (USDC to the splitter, token side burned).
- Shared with other chains (`../../core/`):
  - **`GotonV4Hook.sol`** — singleton v4 hook (permission bits `0x20CC`): launcher-only pool
    initialization, fixed buy/sell tax in USDC, decaying anti-snipe tax, graduation tracking.
  - **`GotonFeeSplitter.sol`** — per-token fee router: 30% protocol cut, remainder to holders (USDC
    dividends streamed over a day, checkpointed on every transfer) / burn / creator (pulled, 48h
    redirect timelock) / liquidity. `GotonFeeSplitterDeployer` creates them.
  - **`GotonV4Router.sol`** — exact-input swaps; buys can be paid with native USDC `msg.value`.
  - `LaunchpadToken.sol`, `../../libraries/v4/` (TickMath, V4Lib), `../../interfaces/external/IUniswapV4Core.sol`.

---

## 4. External Uniswap v4 Infrastructure

- **PoolManager**: `0x8366a39CC670B4001A1121B8F6A443A643e40951`
- **PositionManager**: `0x6049c9a0e26405C0985f9E3685C87d0aE917f82B` (not used by launches)
- **Universal Router**: `0x4fcA4a51Ab4F23A7447b3284fBd7D73289A89Fb1` (frontend trading path, via Permit2)
- **Permit2**: `0x000000000022D473030F116dDEE9F6B43aC78BA3`
- **Protocol Fee Recipient**: `0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2`

Deployment, verification and fork testing: see `docs/ARC_DEPLOY.md`.
