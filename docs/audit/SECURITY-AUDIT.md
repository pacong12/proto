# Security Review — Proto Smart Contracts

---

## Scope

|                                  |                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mode**                         | default                                                                                                                                                                                                                                                                                                                                                                    |
| **Files reviewed**               | `BondingCurve.sol` · `BuybackBurner.sol` · `BaseLaunchpadFactory.sol`<br>`HolderFeeDistributor.sol` · `LaunchpadFactory.sol` · `LaunchpadToken.sol`<br>`LaunchpadV2FactoryArc.sol` · `LaunchpadV2Factory.sol` · `AntiSnipeLogic.sol`<br>`CurveMath.sol` · `FeeMath.sol` · `LiquidityLocker.sol`<br>`ProtoLiquidityLockerV4.sol` · `ProtoMemeHook.sol` · `VestingVault.sol` |
| **Confidence threshold (1-100)** | 80                                                                                                                                                                                                                                                                                                                                                                         |

---

## Findings

[100] **1. Inverted SqrtPriceX96 Calculation for Uniswap V4 Pool Initialization Drains Graduated Liquidity**

`CurveMath.computeSqrtPriceX96` · Confidence: 100

**Description**
`CurveMath.computeSqrtPriceX96` calculates sqrt(ethReserve) / sqrt(tokenReserve) instead of sqrt(tokenReserve) / sqrt(ethReserve), inverting the Uniswap V4 pool initialization price by a factor of ~4.86e7 and enabling immediate drainage of all 4.20 ETH graduated LP liquidity via arbitrage.

**Fix**

```diff
--- a/contracts/src/libraries/CurveMath.sol
+++ b/contracts/src/libraries/CurveMath.sol
@@ -126,8 +126,8 @@ library CurveMath {
     ) internal pure returns (uint160) {
         if (tokenReserve == 0 || ethReserve == 0) revert ZeroReserve();
-        uint256 sqrtNum = sqrt(ethReserve);
-        uint256 sqrtDen = sqrt(tokenReserve);
+        uint256 sqrtNum = sqrt(tokenReserve);
+        uint256 sqrtDen = sqrt(ethReserve);
         if (sqrtDen == 0) revert ZeroReserve();
         uint256 result = (sqrtNum << 96) / sqrtDen;
         if (result > type(uint160).max) revert Overflow();
```

---

[100] **2. Cross-Token Global Native ETH Drainage and Discarded Protocol Fee Share in claimFees**

`ProtoLiquidityLockerV4.claimFees` · Confidence: 100

**Description**
`ProtoLiquidityLockerV4.claimFees` calculates creator payouts using global `address(this).balance` across all tokens and discards the protocol fee share without transferring it, enabling any token deployer to repeatedly call `claimFees` in a loop and drain 100% of contract-wide ETH belonging to other tokens and the protocol treasury.

**Fix (Option A — Segregated per-token accounting and protocol fee routing)**:

```diff
--- a/contracts/src/ProtoLiquidityLockerV4.sol
+++ b/contracts/src/ProtoLiquidityLockerV4.sol
@@ -46,6 +46,8 @@ contract ProtoLiquidityLockerV4 is ILiquidityLocker {
     mapping(address => address) public override feeRedirects;
     mapping(address => PendingRedirect) public pendingFeeRedirects;
+    mapping(address => uint256) public tokenEthFees;
+    mapping(address => uint256) public tokenTokenFees;
@@ -161,9 +163,14 @@ contract ProtoLiquidityLockerV4 is ILiquidityLocker {
         // Accumulate pending balance held by the locker
-        uint256 tokenBal = ILaunchpadToken(token).balanceOf(address(this));
-        uint256 wethBal = address(this).balance;
+        uint256 tokenBal = tokenTokenFees[token];
+        uint256 wethBal = tokenEthFees[token];
+        tokenTokenFees[token] = 0;
+        tokenEthFees[token] = 0;

         uint256 protocolSharePercent = tokenProtocolFeeShares[token];
-        (creatorTokenFee, ) = FeeMath.calculateLockerSplit(tokenBal, protocolSharePercent);
-        (creatorWethFee, ) = FeeMath.calculateLockerSplit(wethBal, protocolSharePercent);
+        uint256 protocolTokenFee;
+        uint256 protocolWethFee;
+        (creatorTokenFee, protocolTokenFee) = FeeMath.calculateLockerSplit(tokenBal, protocolSharePercent);
+        (creatorWethFee, protocolWethFee) = FeeMath.calculateLockerSplit(wethBal, protocolSharePercent);
+        if (protocolTokenFee > 0) ILaunchpadToken(token).transfer(protocolFeeRecipient, protocolTokenFee);
+        if (protocolWethFee > 0) payable(protocolFeeRecipient).call{value: protocolWethFee}("");
```

**Fix (Option B — Isolated Uniswap V4 position collection)**:

```diff
--- a/contracts/src/ProtoLiquidityLockerV4.sol
+++ b/contracts/src/ProtoLiquidityLockerV4.sol
@@ -161,6 +161,8 @@ contract ProtoLiquidityLockerV4 is ILiquidityLocker {
-        // Accumulate pending balance held by the locker
-        uint256 tokenBal = ILaunchpadToken(token).balanceOf(address(this));
-        uint256 wethBal = address(this).balance;
+        (uint256 tokenBal, uint256 wethBal) = positionManager.collect(positionId, address(this));
+        uint256 protocolSharePercent = tokenProtocolFeeShares[token];
+        (creatorTokenFee, protocolTokenFee) = FeeMath.calculateLockerSplit(tokenBal, protocolSharePercent);
+        (creatorWethFee, protocolWethFee) = FeeMath.calculateLockerSplit(wethBal, protocolSharePercent);
+        if (protocolTokenFee > 0) ILaunchpadToken(token).transfer(protocolFeeRecipient, protocolTokenFee);
+        if (protocolWethFee > 0) payable(protocolFeeRecipient).call{value: protocolWethFee}("");
```

---

[100] **3. Uninitialized Snapshot Balance Wipes Accrued Holder Dividends and Permanently Traps WETH**

`HolderFeeDistributor.earned` · Confidence: 100

**Description**
`HolderFeeDistributor.earned` calculates rewards using min(snapshotBalance, liveBalance), which defaults to zero for any holder prior to calling `checkpoint()`, wiping all accrued dividends upon first interaction and permanently trapping distributed WETH in the contract.

**Fix**

```diff
--- a/contracts/src/HolderFeeDistributor.sol
+++ b/contracts/src/HolderFeeDistributor.sol
@@ -120,5 +120,5 @@ contract HolderFeeDistributor {
         uint256 liveBalance = ILaunchpadToken(token).balanceOf(holder);
         uint256 snap = snapshotBalance[token][holder];
-        uint256 balance = FeeMath.calculateEffectiveBalance(snap, liveBalance);
+        uint256 balance = snap == 0 ? liveBalance : FeeMath.calculateEffectiveBalance(snap, liveBalance);
         uint256 cum = tokenFeeStates[token].rewardPerTokenCumulative;
         uint256 paid = userRewardPerTokenPaid[token][holder];
```

---

[95] **4. Missing receive() Function in Launchpad V2 Factories Reverts Cap-Reaching Token Launches**

`LaunchpadV2Factory.launchTokenV2` · Confidence: 95

**Description**
`BondingCurve.buyFor` attempts to refund excess quote funds to `msg.sender` (the factory contract) when an initial buy reaches the curve cap, which unconditionally reverts with `TransferFailed()` because `LaunchpadV2Factory` and `LaunchpadV2FactoryArc` lack `receive()` or `fallback()` payable functions.

**Fix (Option A — Implement payable receive on factory contracts)**:

```diff
--- a/contracts/src/LaunchpadV2Factory.sol
+++ b/contracts/src/LaunchpadV2Factory.sol
@@ -93,6 +93,8 @@ contract LaunchpadV2Factory {
         owner = msg.sender;
     }
+
+    receive() external payable {}
```

**Fix (Option B — Route refund directly to recipient in BondingCurve.buyFor)**:

```diff
--- a/contracts/src/BondingCurve.sol
+++ b/contracts/src/BondingCurve.sol
@@ -278,4 +278,4 @@ contract BondingCurve {
         if (refundEth > 0) {
-            (bool refundOk, ) = payable(msg.sender).call{value: refundEth}("");
+            (bool refundOk, ) = payable(recipient).call{value: refundEth}("");
             if (!refundOk) revert TransferFailed();
         }
```

---

[95] **5. Token Sell Taxes Deplete Reserves Below Curve Cap, Freezing Curve and Permanently Trapping Raised Funds**

`BondingCurve.sell` · Confidence: 95

**Description**
Tokens diverted to `taxRecipient` on taxed sells permanently deplete the curve's physical balance before `totalEthRaised` reaches `graduationTarget`, causing subsequent buys to revert with `InvalidAmount()` and permanently trapping all raised ETH because `emergencyWithdraw` mandates `graduated == true`.

**Fix**

```diff
--- a/contracts/src/BondingCurve.sol
+++ b/contracts/src/BondingCurve.sol
@@ -434,7 +434,10 @@ contract BondingCurve {
     function emergencyWithdraw(address payable recipient) external nonReentrant onlyFactory {
-        if (!graduated) revert NotGraduated();
         if (migrationExecuted) revert MigrationAlreadyExecuted();
-        if (block.timestamp < graduatedAt + MIGRATION_DEADLINE) revert MigrationDeadlineNotReached();
+        if (graduated) {
+            if (block.timestamp < graduatedAt + MIGRATION_DEADLINE) revert MigrationDeadlineNotReached();
+        } else {
+            if (block.timestamp < launchTime + MIGRATION_DEADLINE) revert MigrationDeadlineNotReached();
+        }
         if (recipient == address(0)) revert ZeroAddress();
```

---

[95] **6. Impossible Single-Sided Full-Range Uniswap V3 Liquidity Mint Deterministically Reverts Token Launches**

`LaunchpadFactory.launchToken` · Confidence: 95

**Description**
`LaunchpadFactory.launchToken` attempts to mint single-sided token liquidity across a full-range tick bracket `[-887200, 887200]` covering the active pool tick with zero WETH, which real Uniswap V3 rejects with zero minted liquidity, causing all launches to revert on slippage checks.

**Fix**

```diff
--- a/contracts/src/LaunchpadFactory.sol
+++ b/contracts/src/LaunchpadFactory.sol
@@ -38,5 +38,5 @@ contract LaunchpadFactory is ILaunchpadFactory {
     uint24 public constant POOL_FEE = 10000;
-    int24 public constant TICK_LOWER = -887200;
+    int24 public constant TICK_LOWER = -207200;
     int24 public constant TICK_UPPER = 887200;
```

---

[90] **7. Curve Cap Exact ETH Truncation Freezes Bonding Curve Just Below Graduation Target**

`BondingCurve.buyFor` · Confidence: 90

**Description**
When a buyer purchases all remaining curve tokens, floor division in platform fee subtraction leaves `netEth` slightly below the exact target, depleting all tokens while leaving `totalEthRaised` wei below `graduationTarget`, freezing the curve permanently.

**Fix**

```diff
--- a/contracts/src/BondingCurve.sol
+++ b/contracts/src/BondingCurve.sol
@@ -261,3 +261,3 @@ contract BondingCurve {
-        bool shouldGraduate = totalEthRaised >= graduationTarget;
+        bool shouldGraduate = totalEthRaised >= graduationTarget || grossTokensOut == curveAvailable;
         if (shouldGraduate) {
```

---

[85] **8. Unrestricted Vesting Schedule Creation Enables Permanent Grant Denial for 1 Wei**

`VestingVault.createVestingSchedule` · Confidence: 85

**Description**
`VestingVault.createVestingSchedule` allows unauthenticated callers to squat on any target `[token][beneficiary]` mapping slot with a 1-wei 100-year schedule, permanently blocking legitimate team or investor allocations because revocation is restricted to the attacker.

**Fix**

```diff
--- a/contracts/src/VestingVault.sol
+++ b/contracts/src/VestingVault.sol
@@ -28,3 +28,3 @@ contract VestingVault {
-    // token => beneficiary => Schedule
-    mapping(address => mapping(address => Schedule)) public vestingSchedules;
+    // token => creator => beneficiary => Schedule
+    mapping(address => mapping(address => mapping(address => Schedule))) public vestingSchedules;
```

---

[85] **9. One-Time setLiquidityPool Binding Disables Creator Trading Taxes Post-Graduation on DEX**

`LaunchpadToken.setLiquidityPool` · Confidence: 85

**Description**
`LaunchpadToken.setLiquidityPool` enforces a strict one-time assignment that binds `liquidityPool` to the initial bonding curve, preventing it from being updated to the graduated DEX pool and permanently disabling creator buy/sell taxes on secondary markets.

**Fix**

```diff
--- a/contracts/src/LaunchpadToken.sol
+++ b/contracts/src/LaunchpadToken.sol
@@ -278,4 +278,3 @@ contract LaunchpadToken is ILaunchpadToken {
     function setLiquidityPool(address pool) external override onlyFactory {
-        if (liquidityPool != address(0)) revert PoolAlreadySet();
         if (pool == address(0)) revert ZeroAddress();
         liquidityPool = pool;
```

---

[85] **10. ProtoMemeHook Discards buybackShareBps and Leaves pendingEthFees Unpopulated**

`ProtoMemeHook.sweepPoolFees` · Confidence: 85

**Description**
`ProtoMemeHook` never populates `pendingEthFees` in any swap hook callback, and `sweepPoolFees` routes 100% of non-creator fees to `protocolFeeRecipient`, completely omitting `buybackShareBps` and starving `buybackVault`.

**Fix**

```diff
--- a/contracts/src/ProtoMemeHook.sol
+++ b/contracts/src/ProtoMemeHook.sol
@@ -194,3 +194,8 @@ contract ProtoMemeHook is IHooks {
             uint256 creatorShare = (ethAvailable * config.creatorFeeShareBps) / 10_000;
-            uint256 protocolShare = ethAvailable - creatorShare;
+            uint256 buybackShare = (ethAvailable * config.buybackShareBps) / 10_000;
+            uint256 protocolShare = ethAvailable - creatorShare - buybackShare;
+            if (buybackShare > 0 && buybackVault != address(0)) {
+                (bool ok3, ) = buybackVault.call{value: buybackShare}("");
+                if (!ok3) revert TransferFailed();
+            }
```

---

[82] **11. Missing protocolFeeRecipient Anti-Snipe Exemption in BaseLaunchpadFactory Causes Trade Reverts**

`BaseLaunchpadFactory._executeLaunchTokenV2` · Confidence: 82

**Description**
`BaseLaunchpadFactory._executeLaunchTokenV2` omits `token.setRestrictionExempt(protocolFeeRecipient, true)`, causing bonding curve trades during the decaying anti-snipe window to revert against `to.code.length > 0` whenever the protocol fee recipient is a smart contract.

**Fix**

```diff
--- a/contracts/src/factories/base/BaseLaunchpadFactory.sol
+++ b/contracts/src/factories/base/BaseLaunchpadFactory.sol
@@ -165,2 +165,3 @@ abstract contract BaseLaunchpadFactory is ILaunchpadV2Factory {
         );
+        token.setRestrictionExempt(protocolFeeRecipient, true);
```

---

[82] **12. Raw ETH Payout Reverts When Fee Redirection Targets Non-Payable HolderFeeDistributor**

`ProtoLiquidityLockerV4.claimFees` · Confidence: 82

**Description**
`ProtoLiquidityLockerV4.claimFees` transfers creator fees via low-level native ETH `call{value: ...}("")`, which reverts with `TransferFailed()` whenever fees are redirected to `HolderFeeDistributor` because `HolderFeeDistributor` lacks a `receive()` or `fallback()` function.

**Fix**

```diff
--- a/contracts/src/ProtoLiquidityLockerV4.sol
+++ b/contracts/src/ProtoLiquidityLockerV4.sol
@@ -176,4 +176,10 @@ contract ProtoLiquidityLockerV4 is ILiquidityLocker {
         if (creatorWethFee > 0) {
+            if (holderFeeDistributor != address(0) && recipient == holderFeeDistributor) {
+                IWETH(weth).deposit{value: creatorWethFee}();
+                IWETH(weth).approve(holderFeeDistributor, creatorWethFee);
+                IHolderFeeDistributor(holderFeeDistributor).depositRewards(token, creatorWethFee);
+            } else {
                 (bool ok, ) = recipient.call{value: creatorWethFee}("");
                 if (!ok) revert TransferFailed();
+            }
         }
```

---

[80] **13. Uncollected Uniswap V4 Position Fees Leaves Trading Yield Stranded**

`ProtoLiquidityLockerV4.claimFees` · Confidence: 80

**Description**
`ProtoLiquidityLockerV4` declares `IPositionManagerV4 public immutable positionManager` but never calls position collection functions before fee calculations, permanently stranding accumulated Uniswap V4 trading fees inside the position manager.

**Fix**

```diff
--- a/contracts/src/ProtoLiquidityLockerV4.sol
+++ b/contracts/src/ProtoLiquidityLockerV4.sol
@@ -160,2 +160,3 @@ contract ProtoLiquidityLockerV4 is ILiquidityLocker {
+        positionManager.collect(positionId, address(this));
         // Accumulate pending balance held by the locker
```

---

[80] **14. Creator Token Fees Redirected to HolderFeeDistributor Are Permanently Trapped**

`LiquidityLocker._routeFees` · Confidence: 80

**Description**
When fee redirection points to `HolderFeeDistributor`, `LiquidityLocker._routeFees` transfers `creatorTokenFee` directly to `HolderFeeDistributor`, which only supports WETH dividends and lacks ERC-20 recovery mechanisms, permanently trapping creator tokens.

**Fix**

```diff
--- a/contracts/src/LiquidityLocker.sol
+++ b/contracts/src/LiquidityLocker.sol
@@ -235,3 +235,6 @@ contract LiquidityLocker is ILiquidityLocker {
         if (dist.creatorTokenFee > 0) {
-            bool ok = ILaunchpadToken(token).transfer(dist.creatorRecipient, dist.creatorTokenFee);
+            address tokenRecipient = (holderFeeDistributor != address(0) && dist.creatorRecipient == holderFeeDistributor)
+                ? tokenDeployers[token]
+                : dist.creatorRecipient;
             bool ok = ILaunchpadToken(token).transfer(tokenRecipient, dist.creatorTokenFee);
             if (!ok) revert TransferFailed();
```

---

[80] **15. Immutable Factory in ProtoLiquidityLockerV4 Blocks LaunchpadV2Factory from Locking Positions**

`ProtoLiquidityLockerV4.constructor` · Confidence: 80

**Description**
`ProtoLiquidityLockerV4.factory` is immutable and set to `msg.sender` (deployer EOA in deployment scripts), preventing the subsequently deployed `LaunchpadV2Factory` from invoking `lockPosition` and causing all V4 LP position locks to revert with `Unauthorized()`.

**Fix**

```diff
--- a/contracts/src/ProtoLiquidityLockerV4.sol
+++ b/contracts/src/ProtoLiquidityLockerV4.sol
@@ -35,3 +35,3 @@ contract ProtoLiquidityLockerV4 is ILiquidityLocker {
     IPositionManagerV4 public immutable positionManager;
-    address public immutable factory;
+    address public factory;
@@ -183,2 +183,6 @@ contract ProtoLiquidityLockerV4 is ILiquidityLocker {
     }
+    function setFactory(address newFactory) external onlyOwner {
+        if (newFactory == address(0)) revert ZeroAddress();
+        factory = newFactory;
+    }
```

---

[78] **16. Permanent Administrative Lockout in LiquidityLocker Due to Factory Ownership Without Pass-Throughs**

`LiquidityLocker.constructor` · Confidence: 78

**Description**
`LaunchpadFactory` deploys `LiquidityLocker` and becomes its immutable owner without exposing pass-through functions, leaving `holderFeeDistributor` permanently `address(0)` and misrouting redirected fees.

---

[75] **17. Instant Timelock Bypass for Deployer Fee Redirection in ProtoLiquidityLockerV4**

`ProtoLiquidityLockerV4.cancelFeeRedirect` · Confidence: 75

**Description**
`ProtoLiquidityLockerV4.cancelFeeRedirect` immediately deletes `feeRedirects[token]` with zero delay, bypassing the 48-hour timelock enforced during redirection setup and allowing deployers to rug community fee redirects without warning.

---

[75] **18. Instant 10% Tax Spike Allowed During Active Trading Blocks in LaunchpadToken**

`LaunchpadToken.setInitialTaxConfig` · Confidence: 75

**Description**
`LaunchpadToken.setInitialTaxConfig` allows token deployers to instantly set sell taxes up to 10% without a timelock during active trading blocks `launchBlock+1` and `launchBlock+2`, allowing deployers to bait early buyers with 0% tax and trap them on exit.

---

Findings List

| #   | Confidence | Title                                                                                                   |
| --- | ---------- | ------------------------------------------------------------------------------------------------------- |
| 1   | [100]      | Inverted SqrtPriceX96 Calculation for Uniswap V4 Pool Initialization Drains Graduated Liquidity         |
| 2   | [100]      | Cross-Token Global Native ETH Drainage and Discarded Protocol Fee Share in claimFees                    |
| 3   | [100]      | Uninitialized Snapshot Balance Wipes Accrued Holder Dividends and Permanently Traps WETH                |
| 4   | [95]       | Missing receive() Function in Launchpad V2 Factories Reverts Cap-Reaching Token Launches                |
| 5   | [95]       | Token Sell Taxes Deplete Reserves Below Curve Cap, Freezing Curve and Permanently Trapping Raised Funds |
| 6   | [95]       | Impossible Single-Sided Full-Range Uniswap V3 Liquidity Mint Deterministically Reverts Token Launches   |
| 7   | [90]       | Curve Cap Exact ETH Truncation Freezes Bonding Curve Just Below Graduation Target                       |
| 8   | [85]       | Unrestricted Vesting Schedule Creation Enables Permanent Grant Denial for 1 Wei                         |
| 9   | [85]       | One-Time setLiquidityPool Binding Disables Creator Trading Taxes Post-Graduation on DEX                 |
| 10  | [85]       | ProtoMemeHook Discards buybackShareBps and Leaves pendingEthFees Unpopulated                            |
| 11  | [82]       | Missing protocolFeeRecipient Anti-Snipe Exemption in BaseLaunchpadFactory Causes Trade Reverts          |
| 12  | [82]       | Raw ETH Payout Reverts When Fee Redirection Targets Non-Payable HolderFeeDistributor                    |
| 13  | [80]       | Uncollected Uniswap V4 Position Fees Leaves Trading Yield Stranded                                      |
| 14  | [80]       | Creator Token Fees Redirected to HolderFeeDistributor Are Permanently Trapped                           |
| 15  | [80]       | Immutable Factory in ProtoLiquidityLockerV4 Blocks LaunchpadV2Factory from Locking Positions            |
| 16  | [78]       | Permanent Administrative Lockout in LiquidityLocker Due to Factory Ownership Without Pass-Throughs      |
| 17  | [75]       | Instant Timelock Bypass for Deployer Fee Redirection in ProtoLiquidityLockerV4                          |
| 18  | [75]       | Instant 10% Tax Spike Allowed During Active Trading Blocks in LaunchpadToken                            |

---

## Leads

_Vulnerability trails with concrete code smells where the full exploit path could not be completed in one analysis pass. These are not false positives — they are high-signal leads for manual review. Not scored._

- **Uniswap V4 Hook Address Flag Mining Absence** — `ProtoMemeHook` — Code smells: missing hook flag validation in address — Uniswap V4 requires specific permission flags encoded in the leading bits of the hook address; if `ProtoMemeHook` is deployed without vanity mining, pool initialization reverts inside `IPoolManager.initialize`.
- **Untrusted Creator Reversion Blocks ProtoMemeHook Fee Sweeping** — `ProtoMemeHook.sweepPoolFees` — Code smells: push over pull external calls without gas caps — `sweepPoolFees` executes `config.creator.call{value: creatorShare}("")` and reverts on failure, allowing a malicious creator contract to permanently block protocol fee collection.

---

> [WARNING] This review was performed by an AI assistant. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Team security reviews, bug bounty programs, and on-chain monitoring are strongly recommended. For a consultation regarding your projects' security, visit [https://www.pashov.com](https://www.pashov.com)
