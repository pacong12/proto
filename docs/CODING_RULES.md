# Coding Rules -- Proto Launchpad Protocol

Version: 1.0  
Applies to: all agents, all contributors  
Scope: `apps/api`, `apps/frontoffice`, `packages/shared-types`, `contracts`, `scripts`, `worker.ts`

These rules are non-negotiable. Every pull request is rejected if any rule is violated.
Run `bun run check` before opening a PR.

---

## Table of Contents

1. [General](#1-general)
2. [Language and Character Set](#2-language-and-character-set)
3. [TypeScript](#3-typescript)
4. [Architecture and Layering](#4-architecture-and-layering)
5. [API Server (`apps/api`)](#5-api-server-appsapi)
6. [Frontend (`apps/frontoffice`)](#6-frontend-appsfrontoffice)
7. [Shared Types (`packages/shared-types`)](#7-shared-types-packagesshared-types)
8. [Smart Contracts (`contracts`)](#8-smart-contracts-contracts)
9. [Security](#9-security)
10. [Error Handling](#10-error-handling)
11. [Testing](#11-testing)
12. [Git and PR](#12-git-and-pr)
13. [Forbidden Patterns](#13-forbidden-patterns)

---

## 1. General

**G-01. Read before writing.**
Before touching any file, read its full content and understand what it does.
Never overwrite a file based on assumptions.

**G-02. One concern per change.**
Each commit addresses exactly one bug or one feature.
Do not bundle unrelated changes in one PR.

**G-03. No cargo-culting.**
Do not copy-paste code from the internet or another project without understanding every line.
If you cannot explain what a block does, do not commit it.

**G-04. Verify before claiming done.**
After every change: run the affected tests, run `vue-tsc --noEmit`, check the API endpoint with curl.
Never report a task complete without evidence.

**G-05. No new dependencies without approval.**
Do not add entries to any `package.json` without explicit approval.
Propose the package name and justification via a comment or IRC message first.

**G-06. No hardcoded production data as fallback.**
Do not hardcode token addresses, prices, balances, or any on-chain state as placeholder or fallback values.
If a value cannot be fetched, surface the error explicitly rather than silently substituting stale data.

---

## 2. Language and Character Set

**L-01. All code and comments in English only.**
Variable names, function names, comments, error messages, log strings: English.
No Indonesian, no other language, in any source file.

**L-02. ASCII only in source files.**
No Unicode outside of string literals that display to the user.
Specifically forbidden everywhere in source code:

- Em-dash U+2014 (written as \u2014)
- Smart quotes U+2018/U+2019 (`'` `'`), U+201C/U+201D (`"` `"`)
- Any emoji character
- Any non-ASCII character in comments, identifiers, or import paths

**L-03. String literals for user-facing text.**
User-facing strings may contain Unicode where the design requires it.
Wrap them in the `t()` i18n helper -- do not inline raw Unicode in template logic.

---

## 3. TypeScript

**T-01. Strict mode is always on.**
`strict: true`, `noImplicitAny: true`, `strictNullChecks: true` are set in `tsconfig.json`.
Never add `// @ts-ignore` or `// @ts-nocheck`. Fix the type error instead.

**T-02. No `any`.**
`any` is forbidden. Use `unknown` when the type is truly unknown and narrow it before use.
Exception: third-party library interop where the type cannot be inferred -- wrap in a typed accessor and document why.

**T-03. Optional chaining for nullable access.**
When a value is `T | null | undefined`, always use `?.` before accessing members.
Never cast away nullability with `!` unless the null case is provably impossible at runtime and you document why.

**T-04. BigInt handling.**
All on-chain amounts (ETH, tokens, block numbers, position IDs) must be typed as `bigint`.
Never pass a `bigint` to `JSON.stringify` without a replacer that converts it to string.
Use the standard replacer: `(_k, v) => typeof v === 'bigint' ? v.toString() : v`.

**T-05. No implicit type widening.**
Use `as const` for literal arrays and objects used as enumerations.
Prefer typed `Record<K, V>` over untyped object literals.

**T-06. Explicit return types on public functions.**
Every exported function must have an explicit return type annotation.
Internal helpers may rely on inference only if the return type is obvious.

**T-07. Prefer `readonly` for data that must not be mutated.**
Domain entities and use case results must use `readonly` fields or `Readonly<T>`.

---

## 4. Architecture and Layering

**A-01. Dependency direction: inward only.**

```
Presentation -> Application -> Domain
Infrastructure -> Application -> Domain
```

Domain never imports from Application or Infrastructure.
Application never imports from Infrastructure or Presentation.
Violating this rule breaks testability and is always rejected.

**A-02. All cross-package shapes live in `packages/shared-types`.**
Never redeclare `ApiEnvelope`, `TokenMarketData`, `LaunchedTokenEntity`, `TransactionIntent`,
or any other shared interface in `apps/api` or `apps/frontoffice`.
If a shape is needed by more than one package, it belongs in shared-types.

**A-03. Use cases are the boundary.**
HTTP controllers call exactly one use case per request.
Controllers validate input and map output; they contain no business logic.

**A-04. Infrastructure implements ports; application defines ports.**
Port interfaces live in `apps/api/src/<module>/domain/ports/`.
Implementations live in `apps/api/src/<module>/infrastructure/`.
Application layer depends only on the port interface, never on the concrete implementation.

**A-05. No cross-module imports.**
`apps/api/src/modules/tokens` must not import from `apps/api/src/modules/security` and vice versa.
Cross-module communication goes through shared-types interfaces or events.

---

## 5. API Server (`apps/api`)

**API-01. All responses use `ApiEnvelope<T>`.**
Every HTTP response body must be shaped as:

```ts
{ success: boolean; data: T | null; error: { code: string; message: string } | null; timestamp: number }
```

Use `ok(data)` and `err(code, message)` from `@proto/shared-types`. Never construct raw JSON responses.

**API-02. HTTP status codes must match the envelope.**
`success: false` with `TOKEN_NOT_FOUND` or `INVALID_ADDRESS` -> HTTP 404.
`success: false` with `INVALID_INPUT`, `INVALID_INTENT`, `VALIDATION_ERROR` -> HTTP 400.
`success: false` with anything else -> HTTP 500.
Use `replyEnvelope()` -- do not hardcode `new Response(...)` with status 200 for error responses.

**API-03. No raw `fetch` or `Response` construction in controllers.**
Controllers return `ApiEnvelope`. The route handler in `server.ts` handles serialization and status.

**API-04. All RPC calls must have `retryCount: 0` on polling clients.**
Polling clients use `http(url, { retryCount: 0, timeout: 10_000 })`.
Errors from polling are caught in try/catch blocks; viem automatic retries cause CPU spikes.

**API-05. Event polling skips already-indexed tokens.**
Before calling `fetchV2LaunchedToken`, check `repository.findByAddress(tokenAddress)`.
If it exists, `continue`. Never re-fetch a token that is already in the DB.

**API-06. Address validation before any getLogs call.**
Before passing any address to `getLogs`, verify `address.length === 42 && address.startsWith('0x')`.
Passing `"0x0"` or any non-42-character string to an RPC node causes a server error.

**API-07. BigInt fields must be serialized before Redis or SQLite.**
`JSON.stringify(bigint)` throws silently in some environments and loudly in others.
All `save()` and cache `set()` calls must pass through the BigInt-safe replacer.
The replacer is defined once in `redis-cache.adapter.ts` -- do not inline it elsewhere.

**API-08. CORS must be explicit.**
`CORS_ALLOWED_ORIGINS` must be set in production environment variables.
Without it, only `localhost:*` origins are permitted.
Public crawler paths (`/dex/*`, `/api/v1/*`) always allow `*` -- do not restrict them.

**API-09. Admin endpoints require `ADMIN_SECRET`.**
Any `POST /api/admin/*` endpoint must verify `Authorization: Bearer <ADMIN_SECRET>`.
Return HTTP 401 immediately if the header is missing or incorrect.
If `ADMIN_SECRET` is not set, the endpoint is disabled.

**API-10. Polling intervals: 60 seconds minimum.**
`setInterval` for event pollers must not be shorter than 60 seconds against public RPC nodes.
Stagger multiple chain pollers by at least 5 seconds using `setTimeout` offset.

**API-11. Global error handlers are mandatory.**
`server.ts` must register `process.on('unhandledRejection', ...)` and `process.on('uncaughtException', ...)`.
These must log the error and continue -- never re-throw or call `process.exit`.

**API-12. SQLite address columns use `COLLATE NOCASE`.**
The `address` column in `tokens` and `market_data` tables is `TEXT PRIMARY KEY COLLATE NOCASE`.
This prevents duplicate rows for checksummed vs lowercase address variants.
All `save()` calls normalize addresses with `.toLowerCase()` before writing.

---

## 6. Frontend (`apps/frontoffice`)

**FE-01. Components never fetch directly.**
All API calls go through a composable in `src/composables/`.
Components call composable functions and read reactive refs; they never call `fetch()` directly.

**FE-02. Shared state uses the store composable.**
When two or more components need the same data, use the shared singleton composable (e.g., `useTokenStore`).
Never duplicate `onMounted` fetch logic in multiple components for the same endpoint.

**FE-03. Optional chaining for API data.**
All fields from API responses (`token`, `marketData`, and their sub-fields) must be accessed with `?.`.
Never assume `marketData` is non-null; it may be absent for newly indexed tokens.
Example: `item.marketData?.priceUsd ?? 0` not `item.marketData.priceUsd`.

**FE-04. No `alert()`, `confirm()`, or `prompt()`.**
All user feedback goes through inline error refs displayed in the template.
Use the `AlertCircle` icon from `lucide-vue-next` with a rose-colored error box.

**FE-05. No hardcoded addresses in components.**
Import contract and WETH addresses from `@proto/shared-types` constants (`ARC_CHAIN`, `ROBINHOOD_CHAIN`).
The pattern `'0x3600000000000000000000000000000000000000'` must not appear in Vue components.

**FE-06. No magic numbers for slippage, fees, or thresholds.**
Export named constants from the composable that owns the logic.
`SLIPPAGE_WARN_THRESHOLD`, `SLIPPAGE_MAX` are defined in `useSwap.ts` and imported by the template.

**FE-07. User wallet rejection is silent.**
When `isUserRejection(error)` returns true, reset state to `idle` -- do not show a red error banner.
The user knows they rejected; showing an error is noise.

**FE-08. Tab and route switches reset amount inputs.**
When the trade tab switches between Buy and Sell, `amountIn` must be reset to `''`.
ETH and token amounts are on different scales; carrying over causes wrong order submissions.

**FE-09. Default network is Arc.**
`getInitialChainId()` defaults to `ARC_CHAIN.chainId` (5042).
This is the network where all launchpad tokens live; users should see tokens without connecting a wallet.

**FE-10. Dynamic chain selection for RPC clients.**
Always call `getPublicClient()` -- never use the singleton `publicClient`.
`getPublicClient()` selects the client based on `walletChainId` at call time.

**FE-11. Token not found surfaces explicitly.**
If `/api/tokens/:address` returns HTTP 404, the trade view renders a visible "Token not found" state.
It must not render a blank or partially loaded page.

**FE-12. vue-tsc must pass with zero errors.**
Run `npx vue-tsc --noEmit` before every commit.
Zero type errors is a hard requirement -- not a goal.

---

## 7. Shared Types (`packages/shared-types`)

**ST-01. Single source of truth.**
Every interface, type, constant, and ABI that is shared between the API and the frontend lives here.
Duplication of shared shapes in `apps/` is forbidden.

**ST-02. ABIs are canonical.**
All contract ABIs are in `packages/shared-types/src/abis/contracts.ts`.
The event name, parameter names, and `indexed` flags in the ABI must exactly match the deployed contract.
Verify topic0 on-chain before adding a new ABI.

**ST-03. `UNDEPLOYED` sentinel for missing contracts.**
When a contract is not yet deployed on a given network, use the exported `UNDEPLOYED` constant
(`0x0000000000000000000000000000000000000000`) -- not an empty string, not a copied mainnet address.
Code that reads a contract address must check for `UNDEPLOYED` and skip the call.

**ST-04. Exports must be explicit.**
Every public symbol exported from `src/index.ts` must be intentional.
Do not use `export * from './everything'` unless the module is a deliberate re-export boundary.

---

## 8. Smart Contracts (`contracts`)

**SC-01. CEI pattern is mandatory.**
Every function that transfers ETH or tokens must follow Checks-Effects-Interactions:

1. Validate preconditions.
2. Update all storage.
3. Make external calls.

**SC-02. Reentrancy guards on all public ETH-receiving functions.**
Any `payable` function or function that calls an external contract must use `ReentrancyGuard`.

**SC-03. No `tx.origin` for authorization.**
Use `msg.sender`. `tx.origin` is vulnerable to phishing and must not appear in auth checks.

**SC-04. Fixed supply -- no post-launch minting.**
Token supply is minted exactly once at deployment to 1,000,000,000 * 10^18.
No `mint()` function is callable after the constructor.

**SC-05. Tests must cover invariants.**
Every invariant in `docs/INVARIANTS.md` must have at least one Foundry test that would fail if the invariant is broken.
New invariants require a corresponding test before the PR is merged.

**SC-06. All constants in ABI must match deployed bytecode.**
Before updating an ABI in `packages/shared-types`, verify the function selector with `cast sig` or etherscan.
A wrong ABI silently returns garbage data.

---

## 9. Security

**SEC-01. No secrets in source code.**
API keys, private keys, JWT secrets, and passwords must never appear in any source file.
They live in `.env` (gitignored) only.
`.env.example` contains only placeholder values (`your_key_here`) -- never real values.

**SEC-02. `.gitignore` must cover all secret files.**
`.env`, `.env.local`, `.env.production`, `*.pem`, `*.key`, and `foundry.toml` with private keys
must be listed in `.gitignore` before the first commit.
Check with `git status --short` -- if `.env` appears, stop immediately.

**SEC-03. Git history must be clean.**
If a secret is accidentally committed, the commit must be removed with `git filter-repo` and
the secret must be rotated before the branch is merged or shared.
Squashing does not remove secrets from git history.

**SEC-04. IP addresses are never logged raw.**
Hash IPs with SHA-256 (truncated to 16 hex chars) before writing to any log.
Use `hashIp()` from `worker.ts` as the reference implementation.

**SEC-05. CSP is enforced in production; Report-Only in staging.**
Set `CSP_REPORT_ONLY=true` in the staging Cloudflare Worker environment.
Set `CSP_REPORT_ONLY=false` (or omit) in production.
Do not skip CSP for "testing" in production.

**SEC-06. Rate limiting covers all non-health routes.**
Standard routes: 120 requests per minute per IP.
Public crawler routes (`/dex/*`, `/api/v1/*`): 600 requests per minute per IP.
`/health` and `/` are exempt.

**SEC-07. CORS is restrictive by default.**
Without `CORS_ALLOWED_ORIGINS`, only `localhost:*` origins are reflected.
In production, set `CORS_ALLOWED_ORIGINS` to the exact origin of the deployed frontend.
Public crawler paths always use `*` -- this is required by DEXScreener and GeckoTerminal specs.

---

## 10. Error Handling

**E-01. Every `async` function has a try/catch or is called inside one.**
Fire-and-forget async IIFE or `setInterval` callbacks must wrap their body in try/catch.
Unhandled promise rejections crash the Bun process even with `process.on('unhandledRejection')`.

**E-02. Errors are logged, not swallowed.**
Empty `catch {}` blocks are forbidden.
At minimum: `catch (e) { console.warn('[Context]', (e as Error).message); }`.
If an error is intentionally ignored, add a comment explaining why.

**E-03. Fail-closed for security checks.**
If `SecurityPolicy.evaluate()` throws or returns an error, the intent is rejected.
Never default to "allow" when the security gate is unavailable.

**E-04. Fail-closed for amount calculations.**
If slippage or minimum output cannot be computed (no quote available), throw an error.
Never substitute `0` as a minimum output -- that exposes the user to 100% slippage.

**E-05. RPC errors are non-fatal in polling context.**
A failed RPC call inside the event poller must log a warning and return 0 (tokens indexed this batch).
It must never crash the server or stop future polls.

**E-06. User-facing errors are human-readable.**
Error messages shown in the UI must explain what happened and what the user can do.
Never display raw viem error objects or stack traces in the browser.

---

## 11. Testing

**TS-01. Run tests before every PR.**

```bash
bun test                          # all vitest unit tests
cd apps/frontoffice && npx vue-tsc --noEmit   # type check
cd contracts && forge test        # Foundry smart contract tests
```

All must pass. Zero failures, zero type errors.

**TS-02. Unit test use cases with mock ports.**
Use case tests must use mock implementations of port interfaces -- never real DB or real RPC.
Test names follow the pattern: `describe('UseCase') > it('should <expected behavior> when <condition>')`.

**TS-03. Test files mirror source structure.**
`apps/api/src/modules/tokens/application/use-cases/get-tokens.use-case.ts`
->
`apps/api/test/modules/tokens/application/use-cases/get-tokens.use-case.spec.ts`

**TS-04. No `console.log` in test files.**
Tests communicate results via assertions, not print statements.

**TS-05. No `any` in test files.**
The same TypeScript rules apply in tests as in production code.

**TS-06. Integration tests hit real endpoints with curl.**
After an API change, verify with `curl -s http://localhost:3001/<route>` before marking done.
Document the curl command and its expected output in the PR description.

---

## 12. Git and PR

**G-01. Branch naming.**

```
feat/<scope>-<short-description>    # new feature
fix/<scope>-<short-description>     # bug fix
chore/<scope>-<short-description>   # tooling, deps, config
docs/<short-description>            # documentation only
```

Scopes: `api`, `frontend`, `contracts`, `shared`, `worker`, `scripts`

**G-02. Commit messages: imperative present tense, English.**

```
fix(api): return HTTP 404 when token not found
feat(frontend): add shared useTokenStore singleton
chore(worker): add CSP report-only env var
```

No past tense ("fixed"), no vague messages ("update stuff"), no emoji.

**G-03. One logical change per commit.**
Commits that touch more than 5 files in unrelated areas will be asked to be split.

**G-04. PR description must include verification.**
Every PR must include:

- What was changed and why
- How to verify (commands to run)
- Evidence (output of curl, test results, or screenshot for UI changes)

**G-05. No direct push to `main`.**
All changes go through a PR. At least one review is required before merge.

**G-06. Rebase, do not merge.**
`git rebase origin/main` before opening a PR. Merge commits in feature branches are not allowed.

---

## 13. Forbidden Patterns

These patterns are rejected in any PR, no exceptions.

| Pattern                                               | Why                                                | Alternative                                                                |
| ----------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| `alert()`, `confirm()`, `prompt()`                    | Blocks UI thread, no styling control               | Inline `ref` + template error display                                      |
| `console.log` in production code                      | Log pollution, potential data leak                 | `logger.info/warn/error` from observability module                         |
| `JSON.stringify(bigint)` without replacer             | Throws or produces `undefined`                     | BigInt-safe replacer `(_k, v) => typeof v === 'bigint' ? v.toString() : v` |
| `// @ts-ignore` or `// @ts-nocheck`                   | Hides real type errors                             | Fix the underlying type error                                              |
| `any` type annotation                                 | Defeats type safety                                | `unknown` + type narrowing                                                 |
| Hardcoded contract addresses in `.vue` files          | Duplicates source of truth, breaks on chain change | Import from `@proto/shared-types` constants                                |
| Raw `fetch('/api/...')` in Vue components             | Bypasses error handling and loading state          | Use composable from `src/composables/`                                     |
| Empty `catch {}`                                      | Silently swallows errors                           | `catch (e) { logger.warn(...) }` minimum                                   |
| `!` non-null assertion without comment                | Hides null bugs                                    | Use `?.` or narrow the type explicitly                                     |
| Emoji in source code or comments                      | Non-ASCII, confuses diffs, encoding issues         | Plain English text                                                         |
| Indonesian comments                                   | Non-English, violates L-01                         | English only                                                               |
| `process.exit()` in server code                       | Crashes the server                                 | Log the error, continue                                                    |
| `JSON.parse` without try/catch                        | Throws on malformed input                          | Wrap in try/catch, return error envelope                                   |
| Magic numbers for chain IDs                           | Breaks when network config changes                 | `ARC_CHAIN.chainId`, `ROBINHOOD_CHAIN.chainId`                             |
| `viem` `retryCount > 0` on polling clients            | CPU spike on revert errors                         | `retryCount: 0` on all polling transports                                  |
| Duplicate `fetch` for same data in sibling components | Wastes requests, races on state                    | Shared store composable singleton                                          |
| `0x0` or short address as sentinel                    | Passes truthy check, breaks RPC                    | `UNDEPLOYED = '0x0000000000000000000000000000000000000000'`                |
| `return 4663` hardcoded default chain                 | Wrong default for launchpad (Arc-first)            | `return ARC_CHAIN.chainId`                                                 |
| `.env` with real secrets committed                    | Exposes credentials in git history                 | `.env` in `.gitignore`, use `.env.example`                                 |

---

## Quick Reference: Pre-Commit Checklist

```bash
# 1. TypeScript -- zero errors required
cd apps/frontoffice && npx vue-tsc --noEmit

# 2. Unit tests
bun test

# 3. API smoke test (server must be running)
curl -s http://localhost:3001/health
curl -s http://localhost:3001/api/tokens | python3 -c "import sys,json; d=json.load(sys.stdin); print('tokens:', len(d['data']))"

# 4. No secrets
git diff --cached | grep -E "PRIVATE_KEY|API_KEY|SECRET" && echo "STOP: secret detected"

# 5. No alert()
grep -r "alert(\|confirm(\|prompt(" apps/frontoffice/src/ && echo "STOP: alert found"

# 6. No non-ASCII in code
grep -Prn "[^\x00-\x7F]" apps/ packages/ scripts/ worker.ts --include="*.ts" --include="*.vue" | grep -v "node_modules" && echo "STOP: non-ASCII found"

# 7. Lint
bun run lint

# 8. Build
cd apps/frontoffice && npx vite build
```

All 8 checks must pass before opening a PR.
