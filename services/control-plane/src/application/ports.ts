import type { BlueprintApprovedV1, BlueprintId, TenantId } from '@helixworks/contracts';
import type { ApprovedBlueprint } from '../domain/blueprint.js';

export interface BlueprintRepository {
  findAnyTenant(blueprintId: BlueprintId, version: number): Promise<ApprovedBlueprint | null>;
  find(
    tenantId: TenantId,
    blueprintId: BlueprintId,
    version: number,
  ): Promise<ApprovedBlueprint | null>;
}

export interface BlueprintUnitOfWork {
  commit(blueprint: ApprovedBlueprint, event: BlueprintApprovedV1): Promise<void>;
}
