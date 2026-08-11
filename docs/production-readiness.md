# Production-readiness evidence

This repository is production-oriented, not a certification that an arbitrary fork
is ready for production. A real deployment must attach evidence for every row.

| Gate        | Required evidence                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| Security    | Threat model, cross-tenant and confused-deputy tests, image/SBOM/provenance scan, secret-canary scan      |
| Reliability | Service SLOs, load/capacity result, timeout/retry budgets, queue-age alarms, dependency failure drills    |
| Recovery    | Encrypted backups, measured restore, RPO/RTO result, failed-canary rollback and event replay              |
| Data        | Migration compatibility, retention/deletion policy, legal holds, tenant export and residual-denial probes |
| Delivery    | Build-once digest, signed provenance, environment-specific plan, canary decision and automatic rollback   |
| Operations  | Dashboards, alerts, runbooks, ownership, incident roles, cost budgets and access-review cadence           |

An HTTP 200 or successful Terraform apply proves plumbing, not the customer outcome.
The supplier workflow must render and complete under a real accepted identity, while
the same probes prove another tenant and a revoked capability are denied.
