import type {
  BlueprintApprovedV1,
  BlueprintId,
  RunCompletedV1,
  RunId,
  TenantId,
} from '@helixworks/contracts';
import type { OutboxRepository } from '@helixworks/service-kit';
import type {
  ApprovedBlueprintReader,
  RunRepository,
  RunUnitOfWork,
} from '../application/ports.js';
import type { Run } from '../domain/run.js';

export class ApprovedBlueprintProjection implements ApprovedBlueprintReader {
  readonly #digests = new Set<string>();
  public apply(event: BlueprintApprovedV1): void {
    this.#digests.add(`${event.tenantId}:${event.payload.blueprintId}:${event.payload.digest}`);
  }
  public isApproved(
    tenantId: TenantId,
    blueprintId: BlueprintId,
    digest: string,
  ): Promise<boolean> {
    return Promise.resolve(this.#digests.has(`${tenantId}:${blueprintId}:${digest}`));
  }
}

export class InMemoryRunStore implements RunRepository, RunUnitOfWork {
  readonly #runs = new Map<string, Run>();
  public constructor(private readonly outbox: OutboxRepository) {}
  public find(tenantId: TenantId, runId: RunId): Promise<Run | null> {
    return Promise.resolve(this.#runs.get(`${tenantId}:${runId}`) ?? null);
  }
  public findAnyTenant(runId: RunId): Promise<Run | null> {
    return Promise.resolve(
      [...this.#runs.values()].find((run) => run.snapshot().runId === runId) ?? null,
    );
  }
  public save(run: Run): Promise<void> {
    const snapshot = run.snapshot();
    this.#runs.set(`${snapshot.tenantId}:${snapshot.runId}`, run);
    return Promise.resolve();
  }
  public async complete(run: Run, event: RunCompletedV1): Promise<void> {
    await this.outbox.append({
      id: event.eventId,
      tenantId: event.tenantId,
      event,
      createdAt: new Date(event.occurredAt),
      publishedAt: null,
      attempts: 0,
    });
    await this.save(run);
  }
}
