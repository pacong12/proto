# Proto Agent & Engineering Guidelines

## Core Principles

- Strict Zero Emojis: No emojis in code, commits, comments, responses, or documentation.
- Clean Architecture: Outer layers depend inward. Domain has zero external dependencies.
- Fail-Closed Security: Transaction intents evaluated via SecurityPolicy before signing.
- Quality Gates: All PRs and branches must pass lint, typecheck, test, and build before merge.

## Architecture Boundaries

- `contracts/`: Solidity smart contracts (Foundry), self-describing metadata, atomic launch, V3 locker.
- `packages/shared-types/`: Shared domain models, intent schemas, API envelopes, and contract ABIs.
- `apps/api/`: NestJS backend structured into domain, application, and infrastructure layers.
- `apps/frontoffice/`: Vue 3 + Tailwind frontend for Explore, Create, and Swap trading.
- `docs/`: System documentation, architecture decision records (ADRs), invariants, and goals.

## Quality Commands

```bash
npm run lint          # ESLint with zero-warning threshold
npm run typecheck     # TypeScript compiler across all projects
npm run test          # Vitest and unit test suites
npm run test:contracts # Foundry test suites
npm run build         # Production builds for all applications
```
