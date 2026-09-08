# Proto Development Roadmap

## Phase 1: Foundation & Workspace Scaffolding

- [x] Workspace initialization with Nx, TypeScript, Prettier, ESLint flat config.
- [x] Herdr orchestration tooling and IRC script.
- [x] Clean Architecture documentation, Goals, Invariants, and ADRs.

## Phase 2: Smart Contract Core (Foundry)

- [ ] `LaunchpadToken.sol`: ERC-20 fixed supply with onchain metadata and 2-block anti-snipe logic.
- [ ] `LiquidityLocker.sol`: Permanent V3 NFT locker and 70/30 fee distribution engine.
- [ ] `LaunchpadFactory.sol`: Atomic launch coordinator and pool initialization.
- [ ] Foundry unit and fork test suites verifying graduation and trade mechanics.

## Phase 3: Shared Types & Backend API (Clean Architecture)

- [ ] `@proto/shared-types`: Domain models, intent definitions, ApiEnvelope.
- [ ] `apps/api`: NestJS modular backend with strict domain, application, and infrastructure separation.
- [ ] Security Gate: Intent validation and evaluation pipeline.

## Phase 4: Frontend Web Application

- [ ] `apps/frontoffice`: Vue 3 + TailwindCSS interface.
- [ ] Explore, Create Token, and Trade interfaces.
- [ ] Viem hooks for contract reading, pool quoting, and transaction execution.

## Phase 5: CI/CD Quality Gates & Release

- [ ] GitHub Actions workflow (`.github/workflows/ci.yml`).
- [ ] Full quality gate execution (`lint`, `typecheck`, `test`, `build`).
