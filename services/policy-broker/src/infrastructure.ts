import type { TenantId } from '@helixworks/contracts';
import type { OutboxRecord, OutboxRepository } from '@helixworks/service-kit';
import type { CapabilityGrant } from './domain.js';
import type { AuditSink, CapabilityRepository } from './ports.js';

export class InMemoryPolicyStore implements CapabilityRepository, OutboxRepository, AuditSink {
  readonly #grants = new Map<string, CapabilityGrant>();
  readonly #outbox = new Map<string, OutboxRecord>();
  readonly auditEntries: Array<Parameters<AuditSink['record']>[0]> = [];

  public save(grant: CapabilityGrant): Promise<void> {
    this.#grants.set(grant.id, { ...grant });
    return Promise.resolve();
  }

  public findById(id: string): Promise<CapabilityGrant | null> {
    const grant = this.#grants.get(id);
    return Promise.resolve(grant === undefined ? null : { ...grant });
  }

  public revokeWithOutbox(
    id: string,
    tenantId: TenantId,
    revokedAt: Date,
    record: OutboxRecord,
  ): Promise<boolean> {
    const grant = this.#grants.get(id);
    if (grant === undefined || grant.tenantId !== tenantId) return Promise.resolve(false);
    if (grant.revokedAt !== null) return Promise.resolve(true);
    grant.revokedAt = revokedAt;
    this.#outbox.set(record.id, record);
    return Promise.resolve(true);
  }

  public append(record: OutboxRecord): Promise<void> {
    this.#outbox.set(record.id, record);
    return Promise.resolve();
  }

  public pending(limit: number): Promise<readonly OutboxRecord[]> {
    return Promise.resolve(
      [...this.#outbox.values()].filter((item) => item.publishedAt === null).slice(0, limit),
    );
  }

  public markPublished(id: string, publishedAt: Date): Promise<void> {
    const record = this.#outbox.get(id);
    if (record !== undefined) record.publishedAt = publishedAt;
    return Promise.resolve();
  }

  public markFailed(id: string): Promise<void> {
    const record = this.#outbox.get(id);
    if (record !== undefined) record.attempts += 1;
    return Promise.resolve();
  }

  public record(entry: Parameters<AuditSink['record']>[0]): Promise<void> {
    this.auditEntries.push(entry);
    return Promise.resolve();
  }
}
