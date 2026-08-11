import type { EventEnvelope, TenantId } from '@helixworks/contracts';

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

export interface EventPublisher {
  publish(events: readonly EventEnvelope[]): Promise<void>;
}

export interface OutboxRecord {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly event: EventEnvelope;
  readonly createdAt: Date;
  publishedAt: Date | null;
  attempts: number;
}

export interface OutboxRepository {
  append(record: OutboxRecord): Promise<void>;
  pending(limit: number): Promise<readonly OutboxRecord[]>;
  markPublished(id: string, publishedAt: Date): Promise<void>;
  markFailed(id: string): Promise<void>;
}

export interface InboxRepository {
  claim(consumer: string, idempotencyKey: string): Promise<boolean>;
}

export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
}

export class CryptoIdGenerator implements IdGenerator {
  public next(): string {
    return crypto.randomUUID();
  }
}

export class InMemoryOutboxRepository implements OutboxRepository {
  readonly #records = new Map<string, OutboxRecord>();

  public append(record: OutboxRecord): Promise<void> {
    if (this.#records.has(record.id)) {
      return Promise.resolve();
    }
    this.#records.set(record.id, record);
    return Promise.resolve();
  }

  public pending(limit: number): Promise<readonly OutboxRecord[]> {
    return Promise.resolve(
      [...this.#records.values()].filter((record) => record.publishedAt === null).slice(0, limit),
    );
  }

  public markPublished(id: string, publishedAt: Date): Promise<void> {
    const record = this.#records.get(id);
    if (record !== undefined) {
      record.publishedAt = publishedAt;
    }
    return Promise.resolve();
  }

  public markFailed(id: string): Promise<void> {
    const record = this.#records.get(id);
    if (record !== undefined) {
      record.attempts += 1;
    }
    return Promise.resolve();
  }
}

export class InMemoryInboxRepository implements InboxRepository {
  readonly #claims = new Set<string>();

  public claim(consumer: string, idempotencyKey: string): Promise<boolean> {
    const key = `${consumer}:${idempotencyKey}`;
    if (this.#claims.has(key)) {
      return Promise.resolve(false);
    }
    this.#claims.add(key);
    return Promise.resolve(true);
  }
}

export class OutboxRelay {
  public constructor(
    private readonly outbox: OutboxRepository,
    private readonly publisher: EventPublisher,
    private readonly clock: Clock,
  ) {}

  public async flush(batchSize = 100): Promise<number> {
    const records = await this.outbox.pending(batchSize);
    let published = 0;
    for (const record of records) {
      try {
        await this.publisher.publish([record.event]);
        await this.outbox.markPublished(record.id, this.clock.now());
        published += 1;
      } catch (error: unknown) {
        await this.outbox.markFailed(record.id);
        throw error;
      }
    }
    return published;
  }
}
