# Clean Architecture Refactoring Roadmap for Coding Agents

**Document Type:** Technical Roadmap & Agent Execution Specification  
**Target Audience:** Autonomous & Semi-Autonomous Coding Agents, Software Engineers  
**Scope:** `apps/api`, `apps/frontoffice`, `packages/shared-types`  
**Location:** `docs/CLEAN_ARCHITECTURE_ROADMAP.md` (Not in `apps/docs`)  
**Strict Requirement:** Zero-Loss Refactoring — All trading, bonding curve, fee distribution, slippage, anti-snipe, and wallet mechanics MUST be preserved verbatim.

---

## 1. Executive Context & Objectives

Goton is a multi-chain bonding-curve memecoin launchpad and trading terminal deployed on **Robinhood Chain (Chain ID: 4663)** and **Arc Network (Chain ID: 5042)**.

### Current Architectural Debt:

1. **Backend God File:** `apps/api/src/server.ts` (~2,000 lines) mixes HTTP routing, CORS, rate-limiting, database transactions, block indexers, and business calculations in a single global script.
2. **Frontend God Component:** `apps/frontoffice/src/components/TradeView.vue` (~4,100 lines) mixes swap execution, tax timelocks, wallet states, live polling, chart synchronization, table rendering, and audio/visual animations.
3. **Leaky Layer Boundaries:** Database repositories contain domain pricing logic; controllers contain raw mathematical calculations; UI components trigger raw `fetch()` calls.

### Refactoring Objectives:

- Implement pure **Clean Architecture / Ports & Adapters (Hexagonal)**.
- Isolate business invariants into immutable domain models and testable application use cases.
- Reduce `server.ts` to a thin HTTP router mount (<150 lines).
- Reduce `TradeView.vue` to an orchestration layout container (<200 lines).
- Maintain 100% green CI test suites throughout every single phase.

---

## 2. Target Directory Hierarchy

### 2.1 Backend Architecture (`apps/api/src/`)

```text
apps/api/src/
├── core/                                     # Shared kernel & cross-cutting infrastructure
│   ├── config/                               # Environment, RPC endpoints, contract addresses
│   ├── errors/                               # Domain & HTTP standardized errors
│   │   ├── app-error.ts                      # Base AppError class with HTTP status code
│   │   ├── domain-error.ts                   # Business rule violation error
│   │   └── not-found-error.ts                # Entity not found error
│   ├── http/                                 # HTTP pipeline primitives
│   │   ├── api-envelope.ts                   # Standardized ApiEnvelope<T> responder
│   │   ├── parse-body.ts                     # Safe JSON & multipart request parsers
│   │   └── router.ts                         # Lightweight regex/path router
│   └── middleware/                           # Composable middleware functions
│       ├── cors.middleware.ts                # Origin allowlist & preflight handler
│       ├── rate-limit.middleware.ts          # Tiered rate limiter (terminal/api/crawler/upload)
│       └── error-handler.middleware.ts       # Global uncaught exception mapper
│
├── modules/                                  # Bounded contexts (Vertical feature slices)
│   ├── tokens/                               # Token catalog, creation, and metadata
│   │   ├── domain/                           # Entities, repository ports, pricing calculator
│   │   ├── application/                      # GetTokens, GetTokenByAddress use cases
│   │   ├── infrastructure/                   # SQLite token repository, viem indexer
│   │   └── presentation/                     # Token controller & routes
│   │
│   ├── trades/                               # Trading activity, history, and top traders
│   │   ├── domain/
│   │   │   ├── entities/                     # Trade, TopTrader, TraderPosition
│   │   │   ├── ports/
│   │   │   │   ├── trade-repository.port.ts  # Database port for trades
│   │   │   │   └── price-feed.port.ts        # Quote price oracle port
│   │   │   └── services/                     # Candlestick aggregator & PnL calculator
│   │   ├── application/
│   │   │   ├── use-cases/
│   │   │   │   ├── get-trades.use-case.ts
│   │   │   │   ├── get-top-traders.use-case.ts # With memoization & deterministic sort
│   │   │   │   └── get-candlesticks.use-case.ts
│   │   │   └── dto/                          # Trade response schemas & input validators
│   │   ├── infrastructure/
│   │   │   ├── persistence/
│   │   │   │   ├── sqlite-trade.repository.ts
│   │   │   │   └── trade.mapper.ts
│   │   │   └── cache/
│   │   │       └── top-traders-memory.cache.ts
│   │   └── presentation/
│   │       ├── trade.controller.ts
│   │       └── trade.routes.ts
│   │
│   ├── feed/                                 # Social callouts, comments, likes, reposts
│   │   ├── domain/                           # CommentEntity, CalloutEntity, PnLSnapshot
│   │   ├── application/                      # PostCallout, GetFeed, LikeCallout use cases
│   │   ├── infrastructure/                   # SQLite comment persistence & image handler
│   │   └── presentation/                     # Feed controller & routes
│   │
│   ├── users/                                # User profile, portfolio, and identity
│   │   ├── domain/                           # UserIdentity, PortfolioPosition
│   │   ├── application/                      # GetPortfolio, ResolveIdentity use cases
│   │   ├── infrastructure/                   # SQLite portfolio aggregator
│   │   └── presentation/                     # User controller & routes
│   │
│   ├── indexer/                              # Background event pollers & receipt sync
│   │   ├── event-poller.service.ts           # Chain event listener
│   │   ├── receipt-indexer.service.ts        # Instant post-swap transaction receipt indexer
│   │   └── chain-poller.registry.ts          # Multi-chain poller orchestrator
│   │
│   ├── chains/                               # Multi-chain registry & viem clients
│   │   ├── chain.registry.ts
│   │   └── chain.interface.ts
│   │
│   ├── ipfs/                                 # Pinata/IPFS multipart upload & pinning
│   │   ├── ipfs.service.ts
│   │   └── ipfs.controller.ts
│   │
│   └── observability/                        # Structured logging, metrics, devops
│       ├── domain/ports/
│       ├── infrastructure/
│       └── presentation/
│
├── index.ts                                  # App bootstrap & process signal handling
└── server.ts                                 # High-level HTTP server orchestrator (<150 lines)
```

---

### 2.2 Frontend Architecture (`apps/frontoffice/src/`)

```text
apps/frontoffice/src/
├── core/                                     # Shared foundational utilities
│   ├── api/                                  # Centralized HTTP & multipart client
│   │   ├── api-client.ts                     # apiFetch & uploadFile helpers
│   │   └── error.ts                          # ApiError class
│   ├── constants/                            # Shared network configs, storage keys
│   └── utils/                                # Pure utilities (formatters, time, address)
│
├── features/                                 # Feature-Sliced modules
│   │
│   ├── trade/                                # TRADING TERMINAL FEATURE (Decomposed TradeView)
│   │   ├── domain/                           # Pure business math
│   │   │   ├── curve-math.ts                 # Bonding curve output & price impact formulas
│   │   │   ├── slippage.ts                   # Slippage calculations & tolerance guards
│   │   │   └── pnl.ts                        # Realized & unrealized PnL derivations
│   │   ├── services/                         # Network sync & background polling
│   │   │   ├── trade-poller.service.ts       # Non-overlapping recursive live polling
│   │   │   └── trade-sync.service.ts         # Post-swap on-demand receipt sync trigger
│   │   ├── composables/                      # Reactive state orchestration
│   │   │   ├── useTokenData.ts               # Token metadata, market data, reserves
│   │   │   ├── useSwapExecution.ts           # Viem swap execution, approvals, receipts
│   │   │   ├── useTradesStream.ts            # Live trades list with diff-checking
│   │   │   ├── useTopTradersList.ts          # Top traders list with memoization
│   │   │   └── useTaxTimelock.ts             # Tax banner, timelock configs, claim fees
│   │   └── components/                       # Atomic & composite UI components
│   │       ├── TradeHeader.vue               # MCap, Price ticker, Price Flash, 24h change
│   │       ├── SwapPanel.vue                 # Buy/Sell inputs, slippage settings, CTA button
│   │       ├── TradesTable.vue               # Paginated live trades history
│   │       ├── TopTradersTable.vue           # Paginated top traders leaderboard
│   │       ├── HoldersTable.vue              # Token holders distribution
│   │       ├── DevActivityTab.vue            # Developer holding & renounced status
│   │       ├── TaxTimelockPanel.vue          # Fee sharing & vesting schedule
│   │       └── TradeView.vue                 # Clean layout container (<200 lines)
│   │
│   ├── chart/                                # LIGHTWEIGHT CHARTS FEATURE
│   │   ├── composables/                      # useChartSync, useChartPreferences
│   │   └── components/                       # TradingChart, TimeframeSelector, ChartToolbar
│   │
│   ├── feed/                                 # SOCIAL ALPHA FEED FEATURE
│   │   ├── composables/                      # useFeed, useCalloutComposer
│   │   └── components/                       # FeedView, CalloutCard, ThreadModal, QuoteModal
│   │
│   ├── profile/                              # TRADER PROFILE FEATURE
│   │   ├── composables/                      # useProfile, usePortfolio
│   │   └── components/                       # ProfileView, ProfileHero, CreatedTab, etc.
│   │
│   └── explore/                              # EXPLORE & DISCOVERY FEATURE
│       ├── composables/                      # useExplore, usePinnedTokens
│       └── components/                       # ExploreView, TokenTable, TokenGridCard
│
├── components/ui/                            # Atomic Shadcn UI primitives (Table, Button, etc.)
└── pages/                                    # Thin router view delegates
    ├── TradePage.vue
    ├── FeedPage.vue
    ├── ExplorePage.vue
    └── ProfilePage.vue
```

### 2.3 Shared Monorepo Packages Architecture (`packages/`)

```text
packages/
│
├── contracts-abi/                            # [@goton/contracts-abi]
│   │                                         # Single source of truth for contract ABIs
│   ├── src/
│   │   ├── v2/                               # Active V2 Bonding Curve ABI definitions
│   │   │   ├── bonding-curve.abi.ts          # BondingCurve ABI (as const)
│   │   │   ├── launchpad-token.abi.ts        # ERC-20 LaunchpadToken ABI (as const)
│   │   │   ├── liquidity-locker.abi.ts       # LiquidityLocker & Fee Distributor ABI
│   │   │   └── factory.abi.ts                # LaunchpadV2Factory ABI
│   │   └── index.ts                          # Re-exports with strict Viem Abi types
│   └── scripts/
│       └── export-foundry-abis.ts            # Automation: contracts/out/*.json -> TS const
│
├── math-sdk/                                 # [@goton/math-sdk]
│   │                                         # Pure Domain Math — Shared by Backend & Frontend
│   │                                         # Eliminates dual-calculation drift (e.g. $7k vs $7.6k)
│   ├── src/
│   │   ├── bonding-curve.ts                  # getAmountOut, getAmountIn, spotPrice, priceImpact
│   │   ├── fee-distribution.ts               # 70/30 fee distribution, creator share, holder share
│   │   ├── ohlcv-aggregator.ts               # Pure bucket aggregation & gap-filling math
│   │   └── pnl-calculator.ts                 # Realized & unrealized PnL derivations
│   └── index.ts                              # Zero external dependencies, pure TS functions
│
└── shared-types/                             # [@goton/shared-types]
    │                                         # Pure TypeScript Domain Models & Constants
    ├── src/
    │   ├── domain/                           # Entity interfaces (Token, Trade, Comment, User)
    │   │   ├── token.entity.ts
    │   │   ├── trade.entity.ts
    │   │   ├── comment.entity.ts
    │   │   └── username.ts
    │   ├── chains/                           # Multi-chain metadata & resolver types
    │   │   ├── robinhood.ts                  # Chain ID 4663 config
    │   │   ├── arc.ts                        # Chain ID 5042 config
    │   │   └── resolver.ts                   # Token-to-chain resolver contracts
    │   ├── constants/                        # UNDEPLOYED, MAX_SUPPLY, storage keys
    │   │   └── network.ts
    │   └── index.ts
```

### 2.4 Smart Contracts Architecture (`contracts/`)

```text
contracts/
├── src/
│   ├── interfaces/                           # [PORTS / ABSTRACTION BOUNDARIES]
│   │   ├── core/                             # Internal protocol contract interfaces
│   │   │   ├── ILaunchpadToken.sol           # Token interface with anti-snipe queries
│   │   │   ├── IBondingCurve.sol             # AMM bonding curve interface
│   │   │   ├── IHolderFeeDistributor.sol     # Fee distribution & claim interface
│   │   │   ├── IBuybackBurner.sol            # Buyback and burn engine interface
│   │   │   ├── ILiquidityLocker.sol          # Liquidity locking interface
│   │   │   └── IVestingVault.sol             # Linear vesting schedule interface
│   │   └── external/                         # Third-party DEX & token interfaces
│   │       ├── IUniswapV3.sol                # NonfungiblePositionManager, V3 Pool
│   │       ├── IUniswapV4.sol                # Uniswap V4 PoolManager, PoolId
│   │       └── IWETH.sol                     # WETH9 deposit/withdraw interface
│   │
│   ├── libraries/                            # [PURE VALUE OBJECTS & DOMAIN MATH]
│   │   │                                     # Pure functions, zero state, zero side-effects
│   │   ├── CurveMath.sol                     # AMM reserves formula: k = x * y, spot price
│   │   ├── FeeMath.sol                       # 70/30 fee splits, creator reward, burn share
│   │   └── AntiSnipeLogic.sol                # 2-block restriction & fee decay verification
│   │
│   ├── core/                                 # [DOMAIN ENTITIES / PROTOCOL STATE]
│   │   │                                     # State-bearing contracts enforcing invariants
│   │   ├── LaunchpadToken.sol                # Fixed-supply ERC-20 with on-chain metadata
│   │   ├── BondingCurve.sol                  # AMM bonding curve (uses CurveMath & FeeMath)
│   │   ├── HolderFeeDistributor.sol          # Fee sharing & claim vault
│   │   ├── BuybackBurner.sol                 # Automated token buyback & burner
│   │   ├── LiquidityLocker.sol               # Permanent liquidity locker for graduated pools
│   │   └── VestingVault.sol                  # Linear vesting vault for team allocations
│   │
│   └── factories/                            # [INFRASTRUCTURE / ORCHESTRATORS]
│       ├── base/
│       │   └── BaseLaunchpadFactory.sol      # Abstract factory with shared launch logic (DRY)
│       ├── LaunchpadV2Factory.sol            # Concrete factory for Robinhood Chain (ETH Quote)
│       └── LaunchpadV2FactoryArc.sol         # Concrete factory for Arc Network (USDC Quote)
│
├── script/                                   # [DEPLOYMENT WORKFLOWS / USE CASES]
│   ├── deploy/
│   │   ├── DeployRobinhoodV2.s.sol
│   │   └── DeployArc.s.sol
│   └── simulate/
│       └── SimulateGraduation.s.sol
│
└── test/                                     # [VERIFICATION SUITES]
    ├── unit/                                 # CurveMath.t.sol, FeeMath.t.sol, Token.t.sol
    ├── integration/                          # ComprehensiveLifecycle.t.sol, HolderSharing.t.sol
    ├── forks/                                # ForkRobinhood.t.sol, LaunchpadV2Arc.t.sol
    └── mocks/                                # Mock DEX routers, pools, and WETH
```

### 2.5 Monorepo Cross-Layer Dependency Graph

Dependencies flow strictly inward in one direction without cycles (_Acyclic Dependencies Principle_):

```text
  [ contracts/ ] ──(forge build)──> [ @goton/contracts-abi ]
                                             │
  [ @goton/math-sdk ] <──────────────────────┤ (types & decimals)
          │                                  │
          ▼                                  ▼
  [ @goton/shared-types ] (Pure Domain Interfaces & Constants)
          │
          ├──────────────────────────┐
          ▼                          ▼
  [ apps/api ] (Backend)     [ apps/frontoffice ] (Frontend)
```

---

## 3. Step-by-Step Refactoring Roadmap for Agents

Agents MUST execute this roadmap strictly sequentially. Never begin a new step until all verification commands in the current step pass.

```
[Phase 1: Shared Packages] ──> [Phase 2: Smart Contracts] ──> [Phase 3: Backend Core]
                                                                      │
[Phase 7: Full E2E Audit] <── [Phase 6: Frontend Slim View] <── [Phase 5: Backend Slim Server] <── [Phase 4: Backend Trade Domain]
```

---

### Phase 1: Shared Monorepo Packages Setup (`@goton/math-sdk` & `@goton/contracts-abi`)

**Goal:** Eliminate duplicate calculations between backend and frontend, and establish single-source-of-truth ABIs.

#### Actions:

1. **Scaffold `@goton/math-sdk` in `packages/math-sdk/`:**
   - Extract pure bonding curve functions (`getAmountOut`, `getAmountIn`, `spotPrice`, `priceImpact`).
   - Extract fee splitting (`calculateFeeSplit`: 70% creator, 20% holders, 10% buyback/burn).
   - Extract candlestick gap-filling math (`aggregateCandlesticks`).
   - Extract PnL formulas (`calculateRealizedPnl`, `calculateUnrealizedPnl`).
   - Zero dependencies: pure TypeScript functions with unit test suite.
2. **Scaffold `@goton/contracts-abi` in `packages/contracts-abi/`:**
   - Create script `scripts/export-foundry-abis.ts` to export TypeScript `as const` ABIs from `contracts/out/`.
   - Re-export active V2 ABIs: `bondingCurveAbi`, `launchpadTokenV2Abi`, `liquidityLockerAbi`, `launchpadV2FactoryAbi`.
   - Update `packages/shared-types` to re-export from `@goton/contracts-abi`.

#### Verification Gate:

```bash
bun test packages/math-sdk/
bun run lint
```

---

### Phase 2: Smart Contracts Clean Architecture (`contracts/`)

**Goal:** Decouple protocol invariants into libraries, isolate ports/interfaces, and remove duplicated factory logic.

#### Actions:

1. **Extract Pure Libraries in `contracts/src/libraries/`:**
   - `CurveMath.sol`: Pure virtual reserves math ($k = x \cdot y$), spot pricing, and overflow-safe graduation thresholds.
   - `FeeMath.sol`: Pure 70/30 fee distribution calculations and rounding protection.
   - `AntiSnipeLogic.sol`: Pure block restriction validation and fee decay curve.
2. **Organize Interfaces in `contracts/src/interfaces/`:**
   - Move internal interfaces to `contracts/src/interfaces/core/` (`IBondingCurve.sol`, `ILaunchpadToken.sol`, `ILiquidityLocker.sol`, `IHolderFeeDistributor.sol`, `IBuybackBurner.sol`, `IVestingVault.sol`).
   - Move external DEX interfaces to `contracts/src/interfaces/external/` (`IUniswapV3.sol`, `IUniswapV4.sol`, `IWETH.sol`).
3. **DRY Factory Architecture in `contracts/src/factories/`:**
   - Create `BaseLaunchpadFactory.sol` containing shared launch, token deployment, and tracking logic.
   - Have `LaunchpadV2Factory.sol` (Robinhood ETH) and `LaunchpadV2FactoryArc.sol` (Arc USDC) inherit from `BaseLaunchpadFactory.sol`.
   - Delete deprecated V1 `LaunchpadFactory.sol` artifact completely.

#### Verification Gate:

```bash
forge test
```

---

### Phase 3: Backend Shared Core Extraction (`apps/api/src/core/`)

**Goal:** Establish clean core infrastructure without breaking existing imports.

#### Actions:

1. Create `apps/api/src/core/` and extract primitives from `apps/api/src/server.ts`:
   - `core/errors/app-error.ts` (Standardized `AppError`, `DomainError`, `NotFoundError` with HTTP status).
   - `core/http/api-envelope.ts` (`replyEnvelope`, `replyJson`, `replyError`).
   - `core/middleware/rate-limit.middleware.ts` (`checkRateLimit` supporting `terminal`, `api`, `crawler`, and `upload` tiers).
   - `core/middleware/cors.middleware.ts` (Origin allowlist validation).
2. Ensure all newly extracted core functions export exact TypeScript signatures matching existing usage in `server.ts`.

#### Verification Gate:

```bash
bun run lint
bun run test
```

---

### Phase 4: Backend Trade & Market Domain Extraction

**Goal:** Move trade queries, top traders calculation, and candlestick aggregation out of `server.ts` and `token.controller.ts` into a dedicated `modules/trades/` bounded context.

#### Actions:

1. Create `apps/api/src/modules/trades/`:
   - Move trade entity models to `modules/trades/domain/entities/`.
   - Create `modules/trades/domain/ports/trade-repository.port.ts`.
   - Create `modules/trades/application/use-cases/get-top-traders.use-case.ts`:
     - _Invariant:_ Keep deterministic tie-breaker sorting: `(b.vol - a.vol) || (b.trades - a.trades) || a.address.localeCompare(b.address)`.
     - _Invariant:_ Retain the 3-second in-memory memoization cache.
     - _Invariant:_ Maintain resilient fallback quote price ($2500) if CoinGecko throws.
   - Create `modules/trades/application/use-cases/get-trades.use-case.ts`.
   - Create `modules/trades/application/use-cases/get-candlesticks.use-case.ts` (importing from `@goton/math-sdk`).
2. Implement `modules/trades/presentation/trade.controller.ts`.
3. Create `modules/trades/presentation/trade.routes.ts`.

#### Verification Gate:

```bash
bun test apps/api/test/token.controller.spec.ts
bun test apps/api/test/sqlite-token.repository.spec.ts
bun test apps/api/test/tokens-http.spec.ts
```

---

### Phase 5: Backend Server & Router Modularization

**Goal:** Reduce `apps/api/src/server.ts` from 2,000 lines to a clean master delegator (<150 lines).

#### Actions:

1. Extract modular route handlers:
   - `modules/tokens/presentation/token.routes.ts` (`GET /api/tokens`, `GET /api/tokens/:address`, `GET /api/tokens/:address/holders`)
   - `modules/trades/presentation/trade.routes.ts` (`GET /api/tokens/:address/trades`, `GET /api/tokens/:address/top-traders`, `GET /api/tokens/:address/ohlcv`, `POST /api/tokens/:address/sync`)
   - `modules/feed/presentation/feed.routes.ts` (`GET /api/feed`, `GET /api/callouts`, `POST /api/tokens/:address/comments`, likes, reposts)
   - `modules/users/presentation/user.routes.ts` (`GET /api/users/:param`, `GET /api/users/:param/portfolio`)
2. Refactor `apps/api/src/server.ts` to simply dispatch requests through the modular route handlers.
3. Keep CORS, Rate Limiting, and Security Gate in `server.ts` pipeline.

#### Verification Gate:

```bash
bun run test
bun run lint
bun run format:check
```

---

### Phase 6: Frontend Trade Terminal Decomposition

**Goal:** Break down `apps/frontoffice/src/components/TradeView.vue` (4,100 lines) into focused, single-responsibility composables and components.

#### Actions:

1. **Extract Domain Math:**
   - Use `@goton/math-sdk/bonding-curve` for AMM spot price, output estimation, and reserve math.
   - Create `features/trade/domain/slippage.ts` (minimum received, price impact calculations).
2. **Extract Composables:**
   - Create `features/trade/composables/useTradesStream.ts`:
     - Contains `trades`, `tradesLoading`, `tradesPage`, `filteredTrades`, `paginatedTrades`.
     - Contains `fetchTrades(silent)` with smart diff-checking.
   - Create `features/trade/composables/useTopTradersList.ts`:
     - Contains `topTraders`, `topTradersLoading`, `topTradersPage`, `paginatedTopTraders`.
     - Contains `fetchTopTraders(silent)` with smart diff-checking.
   - Create `features/trade/composables/useTradePoller.ts`:
     - Contains `scheduleNextLivePoll()`, non-overlapping `setTimeout` loop (2000ms), visibility change listener.
3. **Extract UI Sub-components:**
   - `features/trade/components/TradeHeader.vue`: Token symbol, logo, price ticker, market cap, price flash animation.
   - `features/trade/components/SwapPanel.vue`: Buy/Sell tab, input fields, preset buttons (0.1, 0.5, 1 ETH), slippage selector, submit button.
   - `features/trade/components/TradesTable.vue`: Paginated table of live trade events.
   - `features/trade/components/TopTradersTable.vue`: Paginated table of top profitable traders.
4. **Refactor `TradeView.vue`:**
   - Import the sub-components and composables.
   - Restrict `TradeView.vue` strictly to responsive layout scaffolding (<200 lines).

#### Verification Gate:

```bash
bun test apps/frontoffice/test/components.spec.ts
bun test apps/frontoffice/test/trade-badges.spec.ts
bun test apps/frontoffice/test/useLaunchpad.spec.ts
bun run lint
```

---

### Phase 7: Verification & End-to-End Hardening

**Goal:** Verify complete multi-chain resilience, performance gates, and zero regression across the system.

#### Actions:

1. Verify Robinhood Chain & Arc Network contract resolution on all routes.
2. Verify rate-limiting tiers (`terminal`: 600 req/min, `api`: 300 req/min).
3. Verify 1-second chart responsiveness without DOM flickering.
4. Verify all tests in `contracts/` and full repository.

#### Verification Command:

```bash
bun run check # Runs lint, format, typecheck, and all test suites
forge test    # Runs all 50 Solidity contract test suites
```

---

## 4. Agent Rules, Invariants & Anti-Bloat Mandate

### 4.1 Anti-Bloat Mandate: Otoritas Pembuatan File & Folder (Pragmatis, Bukan Patokan Kaku)

**Coding agent diberikan kebebasan penuh dan dianjurkan untuk membuat file, sub-folder, composable, dan modul service baru secara modular agar tidak terjadi penumpukan kode pada satu file.**

- **Prinsip Utama: Single Responsibility & Kohesi, Bukan Angka Paten**
  - Pemisahan kode didasarkan pada **tanggung jawab dan kejelasan logika** (Separation of Concerns), bukan sekadar memotong kode secara kaku demi mengejar target jumlah baris tertentu.
  - Jumlah baris adalah **panduan praktis (rule of thumb/indikator)**, bukan aturan paten yang membatasi:
    - _Komponen UI (`.vue`)_: Idealnya berkisar ~200–400 baris sebagai pedoman umum. Jika sebuah komponen membesar karena menggabungkan modal, tabel, swapping, dan chart sekaligus, pisahkan bagian yang mandiri menjadi sub-komponen. Namun jika komponen memang panjang karena template visual yang kaya atau variasi layout tetapi tetap berfokus pada satu concern, itu wajar dan diizinkan.
    - _Composables & Hooks (`.ts`)_: Fokus pada satu siklus state/concern (misal: satu composable khusus stream trade, satu khusus tax timelock) agar mudah dilacak.
    - _Use Cases & Domain Services (`.ts`)_: Berorientasi pada satu alur bisnis per file agar mudah diuji secara independen.
- **Larangan Menumpuk Kode di God File (Anti-Dumping Rule):**
  - Hindari menumpuk logika baru yang tidak berhubungan (seperti polling loop baru, kalkulasi AMM rumit, atau handler route baru) langsung ke dalam file monolitik yang sudah padat (`TradeView.vue`, `server.ts`).
  - Agent bebas dan didorong untuk langsung membuat file atau direktori baru yang sesuai (misal: `apps/frontoffice/src/features/trade/domain/` atau `apps/api/src/modules/trades/domain/`) untuk menampung fungsi/service tersebut secara bersih dan terisolasi.

### 4.2 Non-Negotiable Protocol Invariants

When implementing changes under this roadmap, coding agents MUST adhere strictly to these invariants:

1. **RULE ARC-01: Zero-Loss Protocol Invariants:**
   - Never alter the bonding curve math (`800M curve tokens`, `200M pool reserve tokens`).
   - Never alter the 70/30 fee distribution mechanism or `LiquidityLocker` address resolution.
   - Never reintroduce removed V1 (Uniswap V3 direct pool) architecture or addresses.

2. **RULE ARC-02: Strict Dependency Flow:**
   - Domain layer files MUST NEVER import from Application, Infrastructure, or Presentation.
   - Application use-cases MUST NEVER import concrete SQLite, Redis, or Viem adapters directly; depend strictly on interfaces from `domain/ports/`.

3. **RULE ARC-03: No Raw `fetch()` in Vue Components (CODING_RULES FE-01):**
   - All HTTP requests in `apps/frontoffice` must go through `apiFetch` or `uploadFile` from `@/lib/api-client` (or `@/core/api/api-client`).

4. **RULE ARC-04: Deterministic Data Structures (CODING_RULES T-02 / G-03):**
   - Never use `as any` casting.
   - Always include deterministic tie-breakers on arrays sorted in memory (`localeCompare(address)`).
   - Use `UNDEPLOYED` constant instead of raw zero addresses (`0x0000...`).

5. **RULE ARC-05: Non-Destructive Step Transitions:**
   - Do not delete old files before the replacement implementation passes all test suites.
   - Every commit must follow Conventional Commits format with valid scope (`api`, `frontoffice`, `trade`, `chart`, `tokens`, etc.).

6. **RULE ARC-06: Clean UI & Zero Emoji Mandate (FE-13 & FE-14):**
   - The UI must maintain pure high-contrast obsidian black (`#000000`), sharp 1px borders (`#18181b`), and semantic trading colors (`--bull` / `--bear`).
   - Strictly ZERO emojis in Vue templates, buttons, badges, toasts, notifications, tooltips, or social share text.
   - Use vector icons from `lucide-vue-next` (e.g. `TrendingUp`, `Flame`, `Sparkles`, `ShieldCheck`) or monospace badges with semantic typography. Emojis render inconsistently and look unprofessional.

---

## 5. Quick Reference: Comprehensive File Migration Map

| Current Location                                                                         | Target Location                                                                 | Purpose                                                        |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Contracts**                                                                            |                                                                                 |                                                                |
| `contracts/src/BondingCurve.sol` (math logic)                                            | `contracts/src/libraries/CurveMath.sol`                                         | Pure AMM reserve & spot price formulas                         |
| `contracts/src/HolderFeeDistributor.sol` (fee logic)                                     | `contracts/src/libraries/FeeMath.sol`                                           | Pure 70/30 fee calculation & rounding safety                   |
| `contracts/src/LaunchpadV2Factory.sol` & `...Arc.sol`                                    | `contracts/src/factories/base/BaseLaunchpadFactory.sol`                         | DRY common factory token creation & tracking                   |
| `contracts/src/interfaces/*.sol`                                                         | `contracts/src/interfaces/core/*.sol` & `external/*.sol`                        | Segregated internal vs external protocol interfaces            |
| **Packages**                                                                             |                                                                                 |                                                                |
| `packages/shared-types/src/abis/contracts.ts`                                            | `packages/contracts-abi/src/v2/*.abi.ts`                                        | Single source of truth for contract ABIs from Foundry          |
| `apps/frontoffice/src/components/TradeView.vue` (math) & `calculate-pricing.use-case.ts` | `packages/math-sdk/src/bonding-curve.ts`                                        | Unified bonding curve calculations (no frontend/backend drift) |
| `apps/api/src/modules/tokens/domain/services/token-aggregation.service.ts`               | `packages/math-sdk/src/ohlcv-aggregator.ts`                                     | Shared OHLCV candle bucket & gap-filling engine                |
| **Backend API**                                                                          |                                                                                 |                                                                |
| `apps/api/src/server.ts` (trade routes)                                                  | `apps/api/src/modules/trades/presentation/trade.routes.ts`                      | Trade & OHLCV endpoint declarations                            |
| `apps/api/src/server.ts` (indexTradeFromReceipt)                                         | `apps/api/src/modules/indexer/receipt-indexer.service.ts`                       | Instant post-swap transaction receipt indexer                  |
| `apps/api/src/server.ts` (rate limit & errors)                                           | `apps/api/src/core/middleware/rate-limit.middleware.ts` & `core/errors/`        | Cross-cutting pipeline middleware                              |
| `apps/api/src/modules/tokens/presentation/token.controller.ts` (`getTopTraders`)         | `apps/api/src/modules/trades/application/use-cases/get-top-traders.use-case.ts` | Leaderboard business rules & memoization                       |
| `apps/api/src/server.ts` (server orchestrator)                                           | `apps/api/src/server.ts` (thin router mount)                                    | Thin router mount delegator                                    |
| **Frontend UI**                                                                          |                                                                                 |                                                                |
| `apps/frontoffice/src/components/TradeView.vue` (swap execution)                         | `apps/frontoffice/src/features/trade/composables/useSwapExecution.ts`           | Viem swap execution & wallet approval lifecycle                |
| `apps/frontoffice/src/components/TradeView.vue` (live polling)                           | `apps/frontoffice/src/features/trade/services/trade-poller.service.ts`          | Non-overlapping recursive background sync                      |
| `apps/frontoffice/src/components/TradeView.vue` (trades table)                           | `apps/frontoffice/src/features/trade/components/TradesTable.vue`                | Standalone UI table for trade events                           |
| `apps/frontoffice/src/components/TradeView.vue` (top traders table)                      | `apps/frontoffice/src/features/trade/components/TopTradersTable.vue`            | Standalone UI table for top traders leaderboard                |
| `apps/frontoffice/src/components/TradeView.vue` (swap panel)                             | `apps/frontoffice/src/features/trade/components/SwapPanel.vue`                  | Standalone Buy/Sell input & CTA form                           |
| `apps/frontoffice/src/components/TradeView.vue` (layout)                                 | `apps/frontoffice/src/features/trade/components/TradeView.vue`                  | Pure responsive grid layout orchestrator                       |
