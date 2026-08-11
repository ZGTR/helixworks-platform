import type { BlueprintId, RunCompletedV1, RunId, TenantId } from '@helixworks/contracts';
import type { Run } from '../domain/run.js';

export interface ApprovedBlueprintReader {
  isApproved(tenantId: TenantId, blueprintId: BlueprintId, digest: string): Promise<boolean>;
}
export interface RunRepository {
  find(tenantId: TenantId, runId: RunId): Promise<Run | null>;
  findAnyTenant(runId: RunId): Promise<Run | null>;
  save(run: Run): Promise<void>;
}
export interface RunUnitOfWork {
  complete(run: Run, event: RunCompletedV1): Promise<void>;
}
