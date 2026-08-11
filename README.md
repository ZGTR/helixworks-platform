# HelixWorks Platform

HelixWorks is a production-oriented reference platform for turning an approved
enterprise workflow into a governed application. The executable tracer follows
supplier onboarding from an immutable blueprint through a bounded run, an exact
connector decision, and build-once promotion across environments.

This repository teaches the architecture behind the two courses at
[mohammadshaker.com](https://mohammadshaker.com/en/courses):

- Building HelixWorks: Production Microservices for AI Workflows
- Securing HelixWorks: Enterprise Agent Authorization

It is intentionally a reference implementation, not a hosted production service.
Production readiness is an evidence claim: adopters still need to run the capacity,
restore, security, compliance, and environment-specific operational gates described
in `docs/production-readiness.md`.

## System boundary

Six deployables own separate state and failure boundaries:

| Deployable           | Owns                                                   |
| -------------------- | ------------------------------------------------------ |
| `control-plane`      | tenants, projects, workflow blueprints, approvals      |
| `run-orchestrator`   | bounded runs, budgets, artifact requests, compensation |
| `policy-broker`      | authorization decisions, capabilities, revocation      |
| `connector-broker`   | typed connector operations and credential references   |
| `release-controller` | environment bindings, promotion, canary, rollback      |
| `evidence-projector` | read-only evidence assembled from domain facts         |

Commands requiring an immediate result use HTTP. Completed facts use a signed,
versioned event envelope, transactional outbox, EventBridge, SQS, and idempotent
inboxes. No service reads another service's database.

## Quick start

```bash
source "$HOME/.nvm/nvm.sh"
nvm use 24
corepack enable
pnpm install --frozen-lockfile
pnpm verify
pnpm smoke:product
```

`pnpm smoke:product` runs the in-process tracer with contract-faithful in-memory adapters:
it approves a blueprint, starts a run, authorizes a connector call, promotes one
artifact digest, injects a duplicate event and failed canary, and verifies rollback.

For local infrastructure:

```bash
docker compose -f deploy/compose.yaml config
docker compose -f deploy/compose.yaml up --build
```

See `docs/architecture.md`, `docs/environments.md`, and `docs/course-map.md`.

## Repository layout

```text
apps/                 external UI and gateway surfaces
services/             independently deployable business capabilities
workers/              asynchronous evidence projection
packages/contracts/   stable HTTP and event contracts
packages/service-kit/ cross-cutting runtime mechanics only
infra/terraform/      AWS foundations and per-environment values
deploy/               local containers and deployment definitions
tests/                cross-service tracer and architecture gates
```

## License

MIT
