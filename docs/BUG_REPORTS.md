# Security Vulnerability & Bug Reports (Final Audit Verification)

Protocol: Proto Launchpad Protocol  
Network: Robinhood Chain (Chain ID: 4663)  
Audited Modules: Smart Contracts, Backend Indexer/API, Frontend Web3 Client  
Audit Date: 2026-09-11

---

## Final Verification Summary

- **Contract Tests (Foundry)**: 6 test suites, 21 tests passed, 0 failed.
- **Unit Tests (Vitest)**: 18 test files, 66 tests passed, 0 failed.
- **Typecheck (TypeScript)**: Clean across all 4 workspaces (`@proto/shared-types`, `@proto/docs`, `@proto/api`, `@proto/frontoffice`).

---

## Final Status Matrix

| Bug ID | Severity | Category                           | Target File                   | Status     | Verification Detail                                                                                |
| :----- | :------- | :--------------------------------- | :---------------------------- | :--------- | :------------------------------------------------------------------------------------------------- |
| BUG-01 | CRITICAL | Confiscation of Funds              | `BondingCurve.sol`            | RESOLVED   | `factory` address added to `currentSnipeTaxBps` exemption. Initial creator buy tax = 0%.           |
| BUG-02 | CRITICAL | Asset Lock                         | `BondingCurve.sol`            | RESOLVED   | `token.transfer(feeRecipient, tokensToMigrate)` added to `_executeGraduationV4()`.                 |
| BUG-03 | CRITICAL | Fund Drainage / Multi-Claim        | `HolderFeeDistributor.sol`    | RESOLVED   | Wallet balance pro-rata dividends restored with initialized precision index. 100% tests pass.      |
| BUG-04 | CRITICAL | Trading Denial of Service          | `useSwap.ts`, `TradeView.vue` | RESOLVED   | V2 bonding curve swaps routed directly to `BondingCurve` (`buy`/`sell`). `swapRouterAbi` exported. |
| BUG-05 | HIGH     | MEV Sandwich Vector                | `BuybackBurner.sol`           | RESOLVED   | `onlyOwner` access control enforced on `executeBuyback`. Cooldown checks verified.                 |
| BUG-06 | HIGH     | Fee Hijacking / Escalation         | `LiquidityLocker.sol`         | RESOLVED   | Removed owner override in `setFeeRedirect`; only `deployer` can redirect creator fees.             |
| BUG-07 | HIGH     | Invariant Broken ($x \cdot y = k$) | `BondingCurve.sol`            | RESOLVED   | `virtualTokenReserve` decrements by `grossTokensOut`, preserving constant product invariant.       |
| BUG-08 | HIGH     | Ingestion Gap                      | `event-poller.service.ts`     | RESOLVED   | V2 curve `Trade` events polled and stored in SQLite repository.                                    |
| BUG-09 | MEDIUM   | Accounting Drift                   | `BondingCurve.sol`            | RESOLVED   | `totalEthRaised` decrements by gross ETH reduction (`ethOut + fee`).                               |
| BUG-10 | MEDIUM   | Trapped ETH                        | `LaunchpadFactory.sol`        | RESOLVED   | Excess `msg.value` above `(launchFee + initialBuyAmount)` refunded to caller.                      |
| BUG-11 | MEDIUM   | Unenforced Configuration           | `BuybackBurner.sol`           | MITIGATED  | Restricted execution to `onlyOwner` preventing external parameter exploitation.                    |
| BUG-12 | MEDIUM   | Architecture Incompatibility       | `LaunchpadToken.sol`          | DOCUMENTED | Architecture constraint noted for future Uniswap v4 hook singleton integration.                    |
| BUG-13 | LOW      | Denial of Service Vector           | `apps/api/src/server.ts`      | RESOLVED   | IP-based rate limiting (120 req/window) active on public routes.                                   |
| BUG-14 | LOW      | Performance Degradation            | `apps/api/src/server.ts`      | RESOLVED   | `/api/analytics` queries bounded with pagination limits.                                           |
