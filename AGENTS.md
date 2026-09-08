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
