# Repository Instructions

HelixWorks is a TypeScript monorepo for a governed enterprise AI workflow platform.

## Commands

```bash
source "$HOME/.nvm/nvm.sh" && nvm use 24
corepack enable
pnpm install --frozen-lockfile
pnpm verify
pnpm smoke:product
terraform -chdir=infra/terraform fmt -check -recursive
```

## Architecture rules

- Strict TypeScript; no `any`.
- SRP: each service owns one business capability and its data.
- DRY stable contracts and mechanics only. Never share domain repositories or a DB.
- MVC at HTTP boundaries: controller -> application use case -> domain/port.
- IoC/DI through one composition root per process.
- HTTP for immediate commands/queries; PubSub only for completed facts.
- Events require tenant scope, schema version, idempotency key, correlation and causation IDs.
- Consumers use an inbox; producers use a transactional outbox.
- Tenant identity is derived from authenticated context, never arbitrary request data.
- Connector code handles credential references, never secret bytes.
- Build once and promote the same immutable artifact digest.
- Local, dev, staging and prod differ through configuration/IaC values, never source forks.
- Add normal, denied/failure, and recovery tests for each boundary.
- Do not claim production readiness without the named runtime evidence.

Use `apply_patch` for edits. Commit completed changes and push feature branches.
