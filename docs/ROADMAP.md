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

- [x] `@proto/shared-types`: Domain models, intent definitions, ApiEnvelope.
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
