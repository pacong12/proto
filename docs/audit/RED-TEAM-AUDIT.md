# Proto Protocol — Red Team Operations & Adversary Simulation Report

> Status remediasi per 2026-10-16: ✅ = sudah diperbaiki, 🟡 = diperbaiki sebagian, ❌ = tidak valid, ⚪ = risiko diterima; verifikasi lengkap di [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

**Classification**: PROTOCOL CONFIDENTIAL / AUTHORIZED SECURITY TESTING  
**Engagement Type**: Full-Scope Protocol Penetration Test & Adversary Simulation  
**Target Scope**: Smart Contracts (`contracts/src/`), Backend Indexer & API (`apps/api/`), Autonomous Keepers, and Frontend Client (`apps/frontoffice/`)  
**Networks Tested**: Robinhood Chain (EVM L2, Chain ID: 4663) and Arc Network (Circle USDC L1, Chain ID: 5042)  
**Methodology**: Threat Modeling, Multi-Stage Exploit Chaining, MITRE ATT&CK Mapping, and Adversarial Economic Simulation

---

## 1. Executive Summary

An authorized full-scope adversary simulation and red team assessment was conducted against the Proto Protocol ecosystem. Unlike traditional static reviews that inspect contracts in isolation, this red team assessment modeled active, economically motivated adversaries exploiting protocol composability, multi-tenant state commingling, off-chain/on-chain trust boundaries, and keeper automation.

The adversary simulation confirmed **6 critical multi-stage attack chains** capable of:

1. Siphoning 100% of Uniswap V4 pool liquidity immediately upon curve graduation via inverted price arbitrage.
2. Draining all accumulated native ETH across all locked tokens from the singleton V4 liquidity locker via repeated single-token fee claims.
3. Permanently freezing user funds inside the bonding curve when tokens are sold with sell taxes, blocking both normal migration and emergency escape valves.
4. Tampering with off-chain token metadata and tax configurations via unauthenticated backend sync endpoints.
5. Extracting protocol buyback capital via MEV sandwich attacks on autonomous keeper executions.
6. Griefing beneficiary vesting allocations permanently for 1 wei of token capital.

---

## 2. Threat Actor Profiles & Simulation Models

The red team modeled five distinct adversary profiles operating against the Proto Protocol:

| Threat Profile                           | Description                                                            | Capabilities & Access                                                             | Primary Objective                                                                 |
| :--------------------------------------- | :--------------------------------------------------------------------- | :-------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| **APT-DeFi-1: Flash Arbitrageur**        | External MEV searcher running automated block-top bundles.             | Unprivileged EOA, high capital flash-loans, sub-millisecond mempool monitoring.   | Drain mispriced pools at graduation and sandwich keeper transactions.             |
| **APT-DeFi-2: Sybil Token Deployer**     | Malicious project creator launching low-cost tokens on Proto.          | Deploys token for 0.0005 ETH, controls creator parameters and tax configurations. | Exploit multi-tenant lockers to drain other tokens' fees and trap retail traders. |
| **APT-DeFi-3: Off-Chain Data Poisoner**  | External network attacker targeting protocol web endpoints.            | Unauthenticated HTTP access to backend API and IPFS gateways.                     | Rewrite database state, misrepresent token taxes, and disrupt live trading data.  |
| **APT-DeFi-4: Malicious Smart Contract** | Untrusted smart contract acting as creator, fee recipient, or trader.  | Non-payable fallback, reentrant hooks, reverting transfer handlers.               | Cause denial of service to fee sweeping, refunds, or distribution cascades.       |
| **APT-DeFi-5: Economic Griefing Actor**  | Low-budget attacker seeking protocol disruption over financial profit. | Minimal capital (dust amounts, 1 wei), public contract access.                    | Lock mapping slots in VestingVault and freeze bonding curves before graduation.   |

---

## 3. Attack Chains & Exploit Scenarios

### Chain Alpha: Catastrophic Post-Graduation Pool Drainage via Inverted SqrtPriceX96

- **Target Components**: `contracts/src/libraries/CurveMath.sol`, `contracts/src/BondingCurve.sol`, Uniswap V4 `PoolManager`
- **Adversary Profile**: APT-DeFi-1 (Flash Arbitrageur)
- **ATT&CK Techniques**: T1190 (Exploitation of Public-Facing Application), T1499 (Endpoint DoS / Asset Drainage)

```
[Target Token Trades on Curve]
              │
              ▼
[Curve Reaches 4.20 ETH Graduation Target]
              │
              ▼
[BondingCurve._prepareGraduationV4 Executes]
              │  Calls CurveMath.computeSqrtPriceX96(5.88 ETH, 285.7M Tokens)
              │  Formula computes sqrt(ETH) / sqrt(Tokens) instead of sqrt(Tokens) / sqrt(ETH)
              ▼
[Uniswap V4 Pool Initialized with Inverted Price (~4.86e7x Mispricing)]
              │
              ▼
[Adversary Submits Atomic Arbitrage Swap in Graduation Block]
              │  Adversary sells near-zero token dust into Uniswap V4 Pool
              ▼
[Outcome: 100% of Graduated 4.20 ETH Drained to Adversary in 1 Transaction]
```

#### Attack Trace & Mechanics

1. A legitimate token reaches graduation target on Robinhood Chain ($4.20 \text{ ETH}$ raised, $1.68 \text{ ETH}$ virtual reserve $\rightarrow 5.88 \text{ ETH}$ total quote reserve; $285,714,285 \times 10^{18}$ reserve tokens).
2. The canonical pool price is:
   $$\text{Price} = \frac{\text{tokenReserve}}{\text{ethReserve}} \approx \frac{285,714,285}{5.88} \approx 48,590,865 \times 10^{18} \text{ tokens per ETH}$$
3. Uniswap V4 defines price as $\text{currency1} / \text{currency0}$. With $\text{currency0} = \text{ETH} (0x0)$ and $\text{currency1} = \text{Token}$, `sqrtPriceX96` must equal:
   $$\sqrt{\frac{\text{tokenReserve}}{\text{ethReserve}}} \times 2^{96}$$
4. `CurveMath.computeSqrtPriceX96` inverts this calculation:
   $$\text{result} = \frac{\sqrt{\text{ethReserve}} \times 2^{96}}{\sqrt{\text{tokenReserve}}}$$
5. The pool opens with 1 token valued at $\sim 48.6 \text{ million ETH}$. The adversary needs only to send $0.000001$ tokens into the pool to withdraw the entire $4.20 \text{ ETH}$ deposit.

---

### Chain Bravo: Multi-Tenant Fee Drain via Singleton V4 Locker Commingling — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Fallback saldo global dihapus; locker V4 diganti graduator + splitter per token. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Target Components**: `contracts/src/ProtoLiquidityLockerV4.sol`
- **Adversary Profile**: APT-DeFi-2 (Sybil Token Deployer)
- **ATT&CK Techniques**: T1078 (Valid Accounts), T1552 (Unchecked Value Flow)

```
[Attacker Launches Token X for 0.0005 ETH via Factory]
              │
              ▼
[Victim Tokens A, B, and C Generate 50 ETH in Trading Fees Locked in Contract]
              │
              ▼
[Attacker Calls ProtoLiquidityLockerV4.claimFees(Token X)]
              │  Locker reads: wethBal = address(this).balance (50 ETH)
              │  Computes creator share: 70% of 50 ETH = 35 ETH
              ▼
[Attacker Receives 35 ETH Belonging to Tokens A, B, C]
              │
              ▼
[Attacker Calls claimFees(Token X) Again in Loop]
              │  Iteration 2: 70% of remaining 15 ETH = 10.5 ETH
              │  Iteration 3: 70% of remaining 4.5 ETH = 3.15 ETH
              │  Iteration 4: 70% of remaining 1.35 ETH = 0.945 ETH
              ▼
[Outcome: Attacker Extracts 49.595 ETH (99.2%) Across All Pools for 0.0005 ETH Cost]
```

#### Attack Trace & Mechanics

1. `ProtoLiquidityLockerV4` is deployed as a single global instance servicing all tokens launched on Robinhood Chain V2.
2. The attacker deploys a throwaway meme token "Token X" through `LaunchpadV2Factory` for the minimum launch fee ($0.0005 \text{ ETH}$). Token X is locked in the locker.
3. Other tokens (Tokens A, B, C) graduate, trade on Uniswap V4, and accumulate fee revenue held in the locker contract.
4. Attacker invokes `claimFees(address(Token X))`. The authorization check validates that `msg.sender == tokenDeployers[Token X]`, which passes.
5. The contract executes:
   ```solidity
   uint256 wethBal = address(this).balance;
   (creatorWethFee, ) = FeeMath.calculateLockerSplit(wethBal, protocolSharePercent);
   recipient.call{value: creatorWethFee}("");
   ```
6. The protocol fee share is discarded without routing, no per-token balance variable is decremented, and the contract balance is reduced only by the attacker's payout.
7. The attacker repeats this call 10 times in a single script, siphoning the entire collective fee treasury.

---

### Chain Charlie: Curve Depletion Deadlock & Permanent Fund Lockup via Sell Tax — ❌ INVALID

> **Status: ❌ INVALID (2026-10-16)** — Fix H-01 sudah membuat saldo token kurva selalu sama dengan `virtualTokenReserve` (penjualan menambah cadangan sebesar token neto setelah pajak), sehingga pembelian tidak macet. Remediasi yang sempat diterapkan (owner boleh `emergencyWithdraw` kurva aktif setelah 180 hari) justru membuka jalur penarikan dana holder dan sudah dicabut. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Target Components**: `contracts/src/BondingCurve.sol`, `contracts/src/LaunchpadToken.sol`
- **Adversary Profile**: APT-DeFi-5 (Economic Griefing Actor) / Emergent Market Dynamics
- **ATT&CK Techniques**: T1499 (Endpoint Denial of Service), T1565 (State Disruption)

```
[Token Launches with 10% Creator Sell Tax]
              │
              ▼
[Users Trade Back and Forth on Bonding Curve]
              │  Every sell transfers tokens to taxRecipient
              │  Physical token balance of curve leaks out
              ▼
[Curve Physical Balance Drops to poolReserveSupply (200M)]
              │  totalEthRaised has only reached 2.50 ETH (Target is 4.20 ETH)
              ▼
[curveAvailable Becomes 0]
              │  getAmountOutBuy returns (0, 0)
              │  All subsequent buy attempts revert with InvalidAmount()
              ▼
[Graduation is Mathematically Unreachable]
              │  graduated remains permanently false
              ▼
[Emergency Withdrawal Safety Valve Blocked]
              │  emergencyWithdraw mandates: if (!graduated) revert NotGraduated()
              ▼
[Outcome: All 2.50 ETH Trapped in Contract Permanently with Zero Recovery Path]
```

#### Attack Trace & Mechanics

1. Creator configures `sellTaxBps = 1000` (10% tax).
2. Trader sells 10,000,000 tokens to curve via `BondingCurve.sell(10_000_000)`.
3. `LaunchpadToken._transfer` diverts 1,000,000 tokens to `taxRecipient`. The curve only receives 9,000,000 tokens.
4. Virtual reserves update: `virtualTokenReserve += 9_000_000`. However, the physical balance in `BondingCurve` is now depleted relative to virtual expectations.
5. After multiple cycles of buys and sells, the physical token balance of the contract equals `poolReserveSupply` ($200,000,000 \text{ tokens}$).
6. At this point:
   ```solidity
   uint256 available = token.balanceOf(address(this));
   uint256 reserveTarget = poolReserveSupply;
   if (available <= reserveTarget) return (0, 0);
   ```
7. Any buyer attempting to purchase tokens receives `(0, 0)`, and `buyFor` reverts:
   ```solidity
   (tokensOut, ) = getAmountOutBuy(msg.value);
   if (tokensOut == 0) revert InvalidAmount();
   ```
8. The curve can never take in more ETH. `totalEthRaised` stays permanently at $2.50 \text{ ETH} < 4.20 \text{ ETH}$.
9. `graduated` is never set to `true`.
10. The factory owner calls `emergencyWithdraw` after 180 days:
    ```solidity
    if (!graduated) revert NotGraduated();
    ```
    The emergency call reverts. The funds are mathematically and administratively unrecoverable.

---

### Chain Delta: Unauthenticated Metadata & Tax Poisoning via REST API — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Endpoint `sync` membaca pajak dan split dari chain, body tidak dipercaya. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Target Components**: `apps/api/src/server.ts`, `apps/api/src/modules/tokens/infrastructure/adapters/sqlite-token.repository.ts`
- **Adversary Profile**: APT-DeFi-3 (Off-Chain Data Poisoner)
- **ATT&CK Techniques**: T1565.001 (Stored Data Manipulation), T1190 (Public Endpoint Abuse)

```
[Attacker Targets POST /api/tokens/:address/sync]
              │
              ▼
[Endpoint Lacks Authentication, Session, or Signature Checks]
              │
              ▼
[Attacker Sends Malicious taxConfig & revenueSplit Payload]
              │  Sets buyTaxBps = 0, sellTaxBps = 0, fake revenueSplit
              ▼
[API Server Accepts Payload and Writes to SQLite Database]
              │
              ▼
[Cached Token Detail Invalidated and Overwritten]
              │
              ▼
[Frontend UI Displays Deceptive Token Data to Users]
              │  Users believe token has 0% tax and 4-way revenue sharing
              ▼
[Users Trade Onchain and Incur Real Undisclosed Onchain Taxes]
```

#### Attack Trace & Mechanics

1. An attacker identifies endpoint `POST /api/tokens/:address/sync` in `server.ts`.
2. The endpoint contains no cryptographic verification of `msg.sender` or deployer authority.
3. If the onchain token has not set tax or returns zero onchain:
   ```typescript
   if (body.taxConfig) {
     if (typeof body.taxConfig.buyTaxBps === 'number') buyTaxBps = body.taxConfig.buyTaxBps;
     if (typeof body.taxConfig.sellTaxBps === 'number') sellTaxBps = body.taxConfig.sellTaxBps;
     if (body.taxConfig.revenueSplit) revenueSplit = body.taxConfig.revenueSplit;
   }
   await repository.save({
     ...existing,
     taxConfig: { buyTaxBps, sellTaxBps, taxRecipient, revenueSplit },
   });
   ```
4. The database is rewritten with arbitrary values supplied by the attacker.
5. All downstream clients querying `/api/tokens/:address` or websocket feeds consume forged metadata.

---

### Chain Echo: Autonomous Keeper Front-Running via Unbounded Slippage Floor — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Keeper melewati buyback bila belum ada rate acuan (tidak ada lagi floor 1 wei). Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Target Components**: `apps/api/src/modules/tokens/infrastructure/keeper/buyback-keeper.service.ts`, `contracts/src/BuybackBurner.sol`
- **Adversary Profile**: APT-DeFi-1 (Flash Arbitrageur / MEV Searcher)
- **ATT&CK Techniques**: T1557 (Adversary-in-the-Middle), T1499 (Economic Extraction)

```
[BuybackBurner Accrues 5 WETH in Protocol Buyback Fees]
              │
              ▼
[Autonomous Keeper Service Wakes Up on Polling Schedule]
              │  Reads lastKnownRate == 0 (First execution)
              │  Keeper calculates minAmountOut = 1 wei
              ▼
[Keeper Submits executeBuyback(1) to Public Mempool]
              │
              ▼
[MEV Bot Detects Transaction with minAmountOut = 1]
              │  Submits Flashbots bundle:
              │  1. Front-run: Buy Target Token, pumping price 100x
              │  2. Victim: Keeper executes buyback at inflated price
              │  3. Back-run: Sell Target Token back to pool
              ▼
[Outcome: 5 WETH Swapped for 1 Wei of Tokens; MEV Bot Extracts ~4.95 WETH Profit]
```

#### Attack Trace & Mechanics

1. `BuybackBurner` holds accumulated WETH from trading fees.
2. On the initial execution, `lastKnownRate` is unseeded (`0`).
3. In `buyback-keeper.service.ts`:
   ```typescript
   let minAmountOut = 1n;
   if (lastKnownRate > 0n) {
     // slippage calculation
   }
   ```
4. The keeper submits `executeBuyback(1n)` with slippage floor set to 1 wei ($10^{-18} \text{ tokens}$).
5. An MEV searcher monitors the transaction in the mempool and executes a sandwich attack:
   - Front-run: Buy target tokens from the Uniswap V3 pool, raising the price by 10,000%.
   - Target: Keeper buys back target tokens with full WETH balance, accepting near-zero tokens because `minAmountOut = 1`.
   - Back-run: Searcher sells their tokens, recovering their principal plus ~99% of the keeper's WETH balance.

---

### Chain Foxtrot: Vesting Slot Squatting Griefing for 1 Wei — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Jadwal vesting dikunci per kreator. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Target Components**: `contracts/src/VestingVault.sol`
- **Adversary Profile**: APT-DeFi-5 (Economic Griefing Actor)
- **ATT&CK Techniques**: T1499 (Denial of Service), T1078 (Access Control Abuse)

```
[Protocol Announces 10,000,000 Token Grant for Core Contributor Bob]
              │
              ▼
[Attacker Detects Announcement and Submits createVestingSchedule]
              │  Parameters: token, Bob, amount = 1 wei, duration = 100 years
              ▼
[VestingVault Writes Schedule into vestingSchedules[token][Bob]]
              │
              ▼
[Protocol Admin Calls createVestingSchedule(token, Bob, 10_000_000, 4 years)]
              │  VestingVault checks: if (existing.exists && !existing.revoked ...) revert ScheduleExists()
              ▼
[Admin Transaction Reverts]
              │
              ▼
[Admin Attempts to Revoke Squatted Schedule]
              │  revokeVesting requires: if (msg.sender != s.creator) revert Unauthorized()
              │  s.creator is the Attacker
              ▼
[Outcome: Bob's Vesting Grant is Permanently Blocked for the Cost of 1 Wei]
```

#### Attack Trace & Mechanics

1. `VestingVault` indexes schedules using a two-tier mapping: `vestingSchedules[token][beneficiary]`.
2. The function `createVestingSchedule` has no access restrictions:
   ```solidity
   Schedule storage existing = vestingSchedules[token][beneficiary];
   if (existing.exists && !existing.revoked && existing.claimedAmount < existing.totalAmount) {
       revert ScheduleExists();
   }
   ```
3. An attacker deposits 1 wei of token with a duration of $3,153,600,000 \text{ seconds}$ (100 years).
4. When the legitimate project authority attempts to create a vesting schedule for that beneficiary, the transaction strictly reverts.
5. Only `s.creator` (the attacker) can call `revokeVesting`. The beneficiary slot is permanently occupied.

---

## 4. MITRE ATT&CK Mapping Matrix

| ATT&CK ID            | Tactic                         | Technique Name                        | Proto Exploit Vector                                                                    | Severity |
| :------------------- | :----------------------------- | :------------------------------------ | :-------------------------------------------------------------------------------------- | :------- |
| **T1190**            | Initial Access / Impact        | Exploit Public-Facing Application     | Inverted `sqrtPriceX96` in `CurveMath.computeSqrtPriceX96` draining Uniswap V4 pool.    | Critical |
| **T1078** ✅         | Defense Evasion / Privilege    | Valid Accounts                        | Multi-tenant balance drain via `ProtoLiquidityLockerV4.claimFees` across foreign pools. | Critical |
| **T1499** ❌ INVALID | Impact                         | Endpoint Denial of Service            | Token sell tax reserve leakage causing permanent bonding curve purchase freeze.         | High     |
| **T1499.004** ✅     | Impact                         | Application Protocol DoS              | Missing `receive()` in `LaunchpadV2Factory` blocking curve cap initial buyouts.         | High     |
| **T1565.001** ✅     | Impact                         | Stored Data Manipulation              | Unauthenticated `POST /api/tokens/:address/sync` overwriting database tax configs.      | High     |
| **T1557** ✅         | Credential Access / Collection | Adversary-in-the-Middle               | Frontrunning `BuybackKeeperService` execution with `minAmountOut = 1`.                  | High     |
| **T1499.003** ✅     | Impact                         | Resource Squatting                    | 1-wei front-running of `VestingVault.createVestingSchedule` slots.                      | Medium   |
| **T1068** ✅         | Privilege Escalation           | Exploitation for Privilege Escalation | `ProtoLiquidityLockerV4.cancelFeeRedirect` instant timelock bypass.                     | Medium   |
| **T1562**            | Defense Evasion                | Impair Defenses                       | `LaunchpadToken.setLiquidityPool` one-time lock disabling post-graduation taxes.        | Medium   |

---

## 5. Blue Team Defensive Playbooks & Circuit Breakers

To defend against the simulated adversary vectors, the defensive engineering team must implement the following multi-layer detections and circuit breakers:

### 5.1. Smart Contract Circuit Breakers

1. **Uniswap V4 Price Bounds Assertion**:
   In `BondingCurve._prepareGraduationV4`, assert that `sqrtPriceX96` is within expected numerical bounds:
   ```solidity
   uint160 sqrtPriceX96 = CurveMath.computeSqrtPriceX96(virtualTokenReserve, virtualEthReserve);
   require(sqrtPriceX96 >= MIN_GRADUATION_SQRT_PRICE && sqrtPriceX96 <= MAX_GRADUATION_SQRT_PRICE, "PRICE_ANOMALY");
   ```
2. **Per-Token Balance Segregation in Lockers**:
   Track fee balances strictly per token. Assert that payouts never exceed the token's accrued ledger:
   ```solidity
   require(tokenEthFees[token] >= creatorWethFee + protocolWethFee, "INSUFFICIENT_TOKEN_FEES");
   ```
3. **Emergency Unconditional Rescue**:
   Decouple `emergencyWithdraw` from `graduated == true` so funds stranded on stalled or bricked curves can be salvaged after deadline expiry.

### 5.2. Off-Chain Keeper Hardening

1. **Quoter-Enforced Slippage Floors**:
   Never default `minAmountOut` to `1n`. Integrate onchain `QuoterV2` / static call simulation immediately prior to transaction dispatch:
   ```typescript
   const quotedAmountOut = await quoterClient.quoteExactInputSingle(...);
   const minAmountOut = (quotedAmountOut * 97n) / 100n; // Strict 3% floor
   ```
2. **Private RPC & Flashbots Submission**:
   Route all keeper buyback transactions through private mempools (e.g. Flashbots Protect or Arbitrum Private RPC) to eliminate public mempool sandwich attacks.

### 5.3. API Endpoint Hardening

1. **Cryptographic Signature Verification**:
   Enforce wallet signature validation on `POST /api/tokens/:address/sync` matching the token's onchain deployer before modifying off-chain state.
2. **Rate Limiting & Body Size Constraints**:
   Apply strict IP-based rate limiting (10 requests/min) on metadata mutation routes.

---

## 6. Remediation Tracking Cross-Reference

| Exploit Chain                | Primary Root Cause                        | Remediation Ticket | Target Component                    |
| :--------------------------- | :---------------------------------------- | :----------------- | :---------------------------------- |
| **Chain Alpha**              | Inverted sqrtPrice formula                | **S1**             | `CurveMath.sol`, `BondingCurve.sol` |
| **Chain Bravo** ✅           | Global ETH reading & fee dropping         | **S2, S13**        | `ProtoLiquidityLockerV4.sol`        |
| **Chain Charlie** ❌ INVALID | Sell tax leakage & locked emergency valve | **S5, S7**         | `BondingCurve.sol`                  |
| **Chain Delta** ✅           | Unauthenticated sync endpoint             | **TKT-09**         | `apps/api/src/server.ts`            |
| **Chain Echo** ✅            | Keeper unbounded slippage floor           | **TKT-06**         | `buyback-keeper.service.ts`         |
| **Chain Foxtrot** ✅         | Vesting slot mapping collision            | **S8**             | `VestingVault.sol`                  |

---

> [WARNING] This report is intended solely for authorized internal security remediation. The attack vectors detailed above are documented to enable robust defensive hardening, invariant validation, and automated detection engineering.
