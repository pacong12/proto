# Proto Development Roadmap

## Phase 1: Foundation & Workspace Scaffolding

- [x] Workspace initialization with Nx, TypeScript, Prettier, ESLint flat config.
- [x] Herdr orchestration tooling and IRC script.
- [x] Clean Architecture documentation, Goals, Invariants, and ADRs.

## Phase 2: Smart Contract Core (Foundry)

- [x] `LaunchpadToken.sol`: ERC-20 fixed supply with onchain metadata and 2-block anti-snipe logic.
- [x] `LiquidityLocker.sol`: Permanent V3 NFT locker and 70/30 fee distribution engine.
- [x] `LaunchpadFactory.sol`: Atomic launch coordinator and pool initialization.
- [x] Foundry unit and fork test suites verifying graduation and trade mechanics.

## Phase 3: Shared Types & Backend API (Clean Architecture)

- [x] `@goton/shared-types`: Domain models, intent definitions, ApiEnvelope.
- [x] `apps/api`: Modular backend with strict domain, application, and infrastructure separation.
- [x] Security Gate: Intent validation and evaluation pipeline.

## Phase 4: Frontend Web Application

- [x] `apps/frontoffice`: Vue 3 + TailwindCSS interface.
- [x] Explore, Create Token, and Trade interfaces.
- [x] Viem hooks for contract reading, pool quoting, and transaction execution.

## Phase 5: CI/CD Quality Gates & Release

- [x] GitHub Actions workflow (`.github/workflows/ci.yml`).
- [x] Full quality gate execution (`lint`, `typecheck`, `test`, `build`).

## Phase 6: Security & Scalability Audit Remediation (2026)

- [x] Smart Contracts: Remediate findings F-01 to F-11 (`BondingCurve`, `BuybackBurner`, `HolderFeeDistributor`, `LaunchpadV2Factory`).
- [x] Backend API: Remediate findings B-01 to B-16 (fail-closed DevOps auth, N+1 query elimination, in-memory rate limit fallback, telemetry sanitization).
- [x] Infrastructure: Redis authentication, SQLite persistent volume, and container resource limits.
- [x] Tooling & Quality: Zero-emoji Conventional Commits guard and git hooks.
- [x] Frontend: API client timeout guards, decimal precision parsing, and multi-language policy pages.

## Phase 7: Clean Architecture Modularization & Anti-Bloat Decomposition

Master implementation specification: [`docs/CLEAN_ARCHITECTURE_ROADMAP.md`](./CLEAN_ARCHITECTURE_ROADMAP.md).  
_Anti-Bloat Mandate: Coding agents are explicitly authorized and required to create new files, sub-folders, and composables rather than accumulating code in monolithic files._

- [ ] **Phase 7.1 — Shared Monorepo Packages**: Create `@goton/math-sdk` (pure bonding curve and PnL math) and `@goton/contracts-abi` (single source of truth for Foundry ABIs).
- [ ] **Phase 7.2 — Smart Contracts Clean Architecture**: Extract pure math into `contracts/src/libraries/` (`CurveMath.sol`, `FeeMath.sol`), segregate interfaces into `interfaces/core/`, and DRY factory orchestrators.
- [ ] **Phase 7.3 — Backend Shared Core & Middleware**: Extract `core/errors/`, `core/http/`, and `core/middleware/` (tiered rate limiting, CORS) from `server.ts`.
- [ ] **Phase 7.4 — Backend Trade Domain Extraction**: Modularize `modules/trades/` with dedicated domain ports, application use cases (`get-top-traders`, `get-trades`), and in-memory cache.
- [ ] **Phase 7.5 — Backend Slim Server**: Decompose `server.ts` from 2,000 lines into modular router delegates.
- [ ] **Phase 7.6 — Frontend Trade Terminal Decomposition**: Break down `TradeView.vue` (4,100 lines) into focused domain math, streaming composables, and atomic components (`TradesTable`, `TopTradersTable`, `SwapPanel`, `TradeHeader`).
- [ ] **Phase 7.7 — End-to-End Verification & Gate Hardening**: Run full multi-chain verification, 1-second chart performance, and strict zero-regression checks.
