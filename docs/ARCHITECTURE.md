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

### 4. Presentation Layer (`apps/api/src/*/presentation` & `apps/frontoffice`)

- Controllers, DTOs, and API envelopes (`ApiEnvelope<T>`).
- Validates HTTP input, delegates to application use cases, and maps results to standard response shapes.
