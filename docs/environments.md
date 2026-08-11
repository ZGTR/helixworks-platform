# Environment contract

The application code is identical in local, dev, staging, and production. Only
validated configuration, infrastructure scale, isolation, and external adapters
change.

| Layer     | Local                            | Dev                         | Staging                                   | Production                                            |
| --------- | -------------------------------- | --------------------------- | ----------------------------------------- | ----------------------------------------------------- |
| Runtime   | Docker Compose                   | ECS Fargate                 | ECS Fargate                               | ECS Fargate, separate account                         |
| Events    | LocalStack EventBridge/SQS       | AWS EventBridge/SQS         | AWS EventBridge/SQS                       | AWS EventBridge/SQS with alarms and restricted replay |
| Data      | Local PostgreSQL, DB per service | Isolated non-production RDS | Production-shaped RDS with synthetic data | Service-owned encrypted RDS instances                 |
| Artifacts | Local object store               | Versioned S3                | Versioned S3                              | Versioned S3 with retention and restricted deletion   |
| Identity  | Development signer/OIDC adapter  | Non-production OIDC tenant  | Production-shaped OIDC tenant             | Production enterprise OIDC and workload task roles    |
| Secrets   | Local-only fake references       | Secrets Manager references  | Secrets Manager references                | Separate account keys and short-lived task access     |

Dev favors disposable review environments. Staging mirrors production topology but
contains synthetic data and cannot reach production connectors. Production has a
separate account, data, keys, queues, secrets, and approval path.

Images are built once. Promotion changes an environment binding to an existing image
and artifact digest. Rebuilding for staging or production invalidates earlier evidence.
