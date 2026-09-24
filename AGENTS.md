# Proto Agent & Engineering Guidelines

## Mandatory Skills Binding

All agents working on this codebase MUST reference and strictly follow the installed specialized agent skills:

1. **Smart Contracts & Security**:
   - `solidity-security`: Adhere to Checks-Effects-Interactions (CEI), reentrancy prevention, access control, and integer safety.
   - `solidity-auditor`: Verify all invariant properties, graduation math, and permanent locker state.
   - Foundry testing: Ensure hermetic unit and fork test execution via `bun run test:contracts`.

2. **Web3 & DEX Integration**:
   - `viem-integration`: Official Uniswap & Viem integration patterns for reading onchain pool state, `slot0.sqrtPriceX96` calculation, and non-custodial wallet client execution.

3. **Frontend Development**:
   - `vue-best-practices` & `vue`: Strict Vue 3 Composition API, type-safe composables (`useLaunchpad`, `useSwap`), and zero direct component-to-RPC coupling.

## Core Rules & Invariants

- **Zero Emojis**: Do not use any emojis in output, comments, documentation, or commit messages.
- **Clean Architecture**: Outer layers depend inward. Domain has zero external dependencies.
- **Fail-Closed Security**: All transaction mutations must form a `TransactionIntent` and pass through `SecurityPolicy.evaluate()` before submission.
- **Strict Quality Gates**: Every PR must pass all CI gates before merging (`lint`, `typecheck`, `test`, `test:contracts`, `build`, `format:check`, `codeql`, `gitleaks`, `slither`).
- **No Direct Push to Main**: All changes must be developed on a dedicated branch, submitted via Pull Request, validated by GitHub Actions, and squash-merged only after green status.

## Quality Commands (with Bun)

```bash
bun install            # Install dependencies with Bun
bun run lint           # Strict ESLint zero-warning check
bun run typecheck      # TypeScript zero-error check across all workspaces
bun run test           # Vitest unit test suites
bun run test:contracts # Foundry smart contract test suites
bun run format:check   # Prettier code format check
bun run build          # Production bundling for all applications
bun run ci             # Full CI pipeline execution
```

## Herdr Workspaces & Multi-Worktree Orchestration

Herdr server is fully configured and ready for parallel agent orchestration:

- **Conductor Workspace**: `~/Downloads/proto`
- **auditor-contracts**: `~/Downloads/proto-wt/contracts` (`feat/contracts-core`)
- **auditor-backend**: `~/Downloads/proto-wt/backend` (`feat/backend-clean-architecture`)
- **auditor-ui**: `~/Downloads/proto-wt/frontoffice` (`feat/frontoffice-ui`)
- **CI / Atomic Commit Guards**: Enforced via `commitlint.config.mjs` and `.github/workflows/commit-check.yml`.

## Commit Convention & Git Workflow

### Format

```text
<type>(<scope>): <short description in imperative mood>

[optional body explaining why, tradeoffs, or breaking changes]
```

### Allowed Types

- `feat`: New feature or user-facing functionality
- `fix`: Bug fix or security remediation
- `docs`: Documentation changes only
- `style`: Code style/formatting changes that do not affect runtime logic
- `refactor`: Code refactoring without behavior change
- `perf`: Performance improvement
- `test`: Adding or correcting tests
- `build`: Changes affecting build system or external tooling
- `ci`: Continuous Integration workflow changes
- `chore`: Maintenance, dependencies, or miscellaneous housekeeping
- `revert`: Reverting a previous commit

### Allowed Scopes

- `contracts`: Solidity smart contracts (bonding curve, factory, locker, etc.)
- `api`: Backend server, routes, middleware, and database adapters
- `tokens`: Token entity logic, pricing, candles, and repository ports
- `frontoffice`: Vue 3 frontend components, pages, and UI
- `trade`: Trading interface, swap execution, and order forms
- `chart`: TradingView / lightweight-charts integration
- `observability`: Logging, Prometheus metrics, cache, and DevOps dashboard
- `security`: Security policies, gate checks, and audit fixes
- `shared-types`: Common TypeScript definitions and network configurations
- `infra`: Docker, Docker Compose, Nginx, and deployment configs
- `deps`: Dependency upgrades and lockfile syncs
- `docs`: Project documentation and guides
- `scripts`: Deployment scripts and operational tools
- `worker`: Cloudflare Worker edge proxy
- `release`: Production release bundling

### Rules & Constraints

1. **Zero Emojis**: Commits containing emojis are strictly rejected by `commitlint` (`no-emoji` rule).
2. **Imperative Mood**: Use imperative present tense ("add", "fix", "implement", not "added", "fixes", "implemented").
3. **Header Length**: Maximum 120 characters total for the commit header.
4. **Atomic Commits**: One logical change per commit. Separate feature code from dependency updates and refactors.
5. **Branch Naming**:
   - `feat/<scope>-<description>`
   - `fix/<scope>-<description>`
   - `chore/<scope>-<description>`
   - `docs/<description>`

### Examples

```text
feat(contracts): add V4 liquidity locker hook
fix(api): resolve N+1 aggregate query in analytics endpoint
feat(frontoffice): implement trade notification toast with tx hash link
chore(deps): update ioredis and viem dependencies
docs(security): document timing-safe token comparison pattern
```
