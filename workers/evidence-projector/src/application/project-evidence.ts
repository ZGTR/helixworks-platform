import { eventEnvelopeSchema, type EventEnvelope } from '@helixworks/contracts';
import type { InboxRepository } from '@helixworks/service-kit';
import type { EvidenceRecord } from '../domain/evidence.js';
import type { EvidenceProjectionWriter } from './ports.js';

const CONSUMER = 'evidence-projector.v1';

function safeIdentifier(payload: Record<string, unknown>, field: string): string | null {
  const value = payload[field];
  return typeof value === 'string' && value.length > 0 && value.length <= 128 ? value : null;
}

export class ProjectEvidence {
  public constructor(
    private readonly inbox: InboxRepository,
    private readonly projection: EvidenceProjectionWriter,
  ) {}

  public async handle(rawEvent: unknown): Promise<boolean> {
    const event = eventEnvelopeSchema.parse(rawEvent);
    const claimed = await this.inbox.claim(CONSUMER, `${event.tenantId}:${event.idempotencyKey}`);
    if (!claimed) {
      return false;
    }

    await this.projection.append(this.toEvidence(event));
    return true;
  }

  private toEvidence(event: EventEnvelope): EvidenceRecord {
    return {
      tenantId: event.tenantId,
      eventId: event.eventId,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      correlationId: event.correlationId,
      causationId: event.causationId,
      aggregateId: event.aggregateId,
      runId: safeIdentifier(event.payload, 'runId'),
      decisionId: safeIdentifier(event.payload, 'decisionId'),
      artifactId: safeIdentifier(event.payload, 'artifactId'),
      releaseId: safeIdentifier(event.payload, 'releaseId'),
    };
  }
}
