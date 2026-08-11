import type { BlueprintApprovedV1, BlueprintId, TenantId } from '@helixworks/contracts';
import type { OutboxRepository } from '@helixworks/service-kit';
import type { BlueprintRepository, BlueprintUnitOfWork } from '../application/ports.js';
import { BlueprintConflictError, type ApprovedBlueprint } from '../domain/blueprint.js';

export class InMemoryBlueprintStore implements BlueprintRepository, BlueprintUnitOfWork {
  readonly #records = new Map<string, ApprovedBlueprint>();
  public constructor(private readonly outbox: OutboxRepository) {}

  public findAnyTenant(id: BlueprintId, version: number): Promise<ApprovedBlueprint | null> {
    return Promise.resolve(
      [...this.#records.values()].find(
        (item) => item.blueprintId === id && item.version === version,
      ) ?? null,
    );
  }

  public find(
    tenantId: TenantId,
    id: BlueprintId,
    version: number,
  ): Promise<ApprovedBlueprint | null> {
    return Promise.resolve(this.#records.get(`${tenantId}:${id}:${version}`) ?? null);
  }

  public async commit(blueprint: ApprovedBlueprint, event: BlueprintApprovedV1): Promise<void> {
    const key = `${blueprint.tenantId}:${blueprint.blueprintId}:${blueprint.version}`;
    if (this.#records.has(key)) throw new BlueprintConflictError('Blueprint version is immutable');
    await this.outbox.append({
      id: event.eventId,
      tenantId: event.tenantId,
      event,
      createdAt: blueprint.approvedAt,
      publishedAt: null,
      attempts: 0,
    });
    this.#records.set(key, blueprint);
  }
}
