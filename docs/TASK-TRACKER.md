# Proto Project Task Tracker & Agent Coordination

## 1. Active Milestones

| Milestone                       | Area      | Description                                                   | Lead Agent   | Status          |
| :------------------------------ | :-------- | :------------------------------------------------------------ | :----------- | :-------------- |
| **M1: Deployment Scripts**      | Contracts | Foundry deployment script for Robinhood Chain & Local Anvil   | `@contracts` | **COMPLETED**   |
| **M2: Real-Time Indexer**       | Backend   | Event poller for `TokenLaunched` and `Swap` with caching      | `@vault`     | **COMPLETED**   |
| **M3: Fee Dashboard & CTO**     | Frontend  | User & Creator profile for fee claims and community takeovers | `@face`      | **IN PROGRESS** |
| **M4: Buyback & Burn Contract** | Contracts | Automated TWAP buyback execution for protocol revenue         | `@contracts` | **PLANNED**     |

---

## 2. Agent Roster & Ownership Boundaries

- **`@conductor`** (Project Manager & Integration Authority):
  - Owns: `docs/**`, root configs, roadmap, pull request review & merge orchestration.
- **`@contracts`** (Smart Contracts Specialist):
  - Owns: `contracts/**` (Solidity, Foundry test suites, deployment scripts, Slither analysis).
- **`@vault`** (Backend API & Security Gate Specialist):
  - Owns: `apps/api/**` (NestJS Clean Architecture, chain indexer, `SecurityPolicy` evaluation).
- **`@face`** (Frontend UX & Web3 Interface Specialist):
  - Owns: `apps/frontoffice/**` (Vue 3, PrimeVue 5, Lucide icons, Viem composables).
- **`@ops`** (DevOps, CI/CD & Toolchain Specialist):
  - Owns: `.github/**`, Bun toolchain, Dependabot, lockfiles.
- **`@reviewer`** (Security & Code Review Specialist):
  - Owns: Static analysis verification, invariant compliance, security checks.
- **`@docs`** (Public Documentation Specialist):
  - Owns: `apps/docs/**` (Public documentation portal).

---

## 3. Mandatory CI Quality Gates

Every pull request must pass all 6 automated GitHub Actions checks:

1. `Clean Code, Strict Any & Format` (ESLint + Prettier)
2. `Secret & Credential Leak Scan` (Gitleaks)
3. `Slither Smart Contract Static Analysis` (Crytic Slither)
4. `CodeQL Static Security Analysis` (GitHub Security)
5. `Lint, Typecheck, Test & Build` (Bun + Foundry)
6. `GitGuardian Security Checks`
