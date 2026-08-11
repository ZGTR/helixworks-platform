import { describe, expect, it } from 'vitest';
import type { EventEnvelope } from '@helixworks/contracts';
import {
  InMemoryInboxRepository,
  InMemoryOutboxRepository,
  OutboxRelay,
  type Clock,
  type EventPublisher,
} from './index.js';

describe('delivery mechanics', () => {
  it('publishes an outbox record once and marks it delivered', async () => {
    const outbox = new InMemoryOutboxRepository();
    const published: EventEnvelope[] = [];
    const publisher: EventPublisher = {
      publish: (events) => {
        published.push(...events);
        return Promise.resolve();
      },
    };
    const clock: Clock = { now: () => new Date('2026-08-11T12:00:00.000Z') };
    const event = {
      eventId: '3edbb60d-754f-45fa-a6cf-8d7ef35e9992',
      eventType: 'BlueprintApproved.v1',
      schemaVersion: 1,
      occurredAt: '2026-08-11T12:00:00.000Z',
      tenantId: 'tenant_northstar',
      aggregateId: 'blueprint_supplier-onboarding',
      idempotencyKey: 'approve:supplier-onboarding:v1',
      correlationId: '067c99d3-d9b4-4ed3-97d1-4fa10d188d52',
      causationId: null,
      traceparent: null,
      payload: {},
    } as EventEnvelope;
    await outbox.append({
      id: event.eventId,
      tenantId: event.tenantId,
      event,
      createdAt: clock.now(),
      publishedAt: null,
      attempts: 0,
    });

    const relay = new OutboxRelay(outbox, publisher, clock);
    expect(await relay.flush()).toBe(1);
    expect(await relay.flush()).toBe(0);
    expect(published).toEqual([event]);
  });

  it('lets an inbox consumer claim one idempotency key once', async () => {
    const inbox = new InMemoryInboxRepository();
    await expect(inbox.claim('evidence', 'event-1')).resolves.toBe(true);
    await expect(inbox.claim('evidence', 'event-1')).resolves.toBe(false);
  });
});
