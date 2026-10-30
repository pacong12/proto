# Clean Architecture Specification

## Layering Invariants

All code follows the Clean Architecture dependency rule: **Dependencies point strictly inward.**

```text
+-------------------------------------------------------------+
| Presentation / Controllers / UI (Apps)                      |
|   +-------------------------------------------------------+ |
|   | Infrastructure (Chain RPC, Viem, Redis, DB Repos)     | |
|   |   +-------------------------------------------------+ | |
|   |   | Application Services / Use Cases / Ports        | | |
|   |   |   +-------------------------------------------+ | | |
|   |   |   | Domain Entities / Value Objects / Rules   | | | |
|   |   |   +-------------------------------------------+ | | |
|   |   +-------------------------------------------------+ | |
|   +-------------------------------------------------------+ |
+-------------------------------------------------------------+
```

### 1. Domain Layer (`apps/api/src/*/domain` & `packages/shared-types`)

- Contains pure business logic, entities, value objects, and domain errors.
- Zero dependencies on frameworks (NestJS), databases, or external libraries.
- Pure TypeScript models and immutable rules.

### 2. Application Layer (`apps/api/src/*/application`)

- Contains use cases, workflows, orchestrators, and port interfaces (input/output boundaries).
- Depends only on Domain.
- Defines repository and external service ports as interfaces.

### 3. Infrastructure Layer (`apps/api/src/*/infrastructure`)

- Implements port interfaces: RPC clients, Viem contract callers, event indexers, and storage adapters.
- Interacts with external systems (Robinhood Chain RPC, Uniswap V3 contracts).
- Storage follows the aggregates: the tokens module's ports are `TokenStorePort`, `TradeStorePort`,
  `SocialStorePort` and `LimitOrderStorePort` (`TokenRepositoryPort` combines them). The SQLite
  adapter has one layer per aggregate on a shared connection and schema: `SqliteDatabase` →
  `SqliteTokenStore` → `SqliteTradeStore` → `SqliteSocialStore` → `SqliteOrderStore`.

### 4. Presentation Layer (`apps/api/src/*/presentation` & `apps/frontoffice`)

- Controllers, DTOs, and API envelopes (`ApiEnvelope<T>`).
- Validates HTTP input, delegates to application use cases, and maps results to standard response shapes.
- Each module registers its HTTP routes in `presentation/<module>.routes.ts`
  (`register<Module>Routes(router, deps)`), on the `Router` from `core/http`. Routes receive their
  services from the container instead of importing them.

### Composition (`apps/api/src`)

- `app/container.ts` is the composition root: it builds every adapter, use case, controller and
  the chain registry once.
- `app/jobs.ts` starts the background work: event pollers, keepers, source verification, market
  data refresh and database backups (none under tests).
- `server.ts` only runs the request pipeline (CORS and security headers, rate limiting), hands the
  request to the router, and serves it with `Bun.serve`.
