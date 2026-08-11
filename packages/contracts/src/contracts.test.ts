import { describe, expect, it } from 'vitest';
import { eventEnvelopeSchema, tenantIdSchema } from './index.js';

describe('event envelope contract', () => {
  it('requires tenant, correlation, causation and idempotency context', () => {
    const result = eventEnvelopeSchema.safeParse({
      eventId: '3edbb60d-754f-45fa-a6cf-8d7ef35e9992',
      eventType: 'BlueprintApproved.v1',
      schemaVersion: 1,
      occurredAt: '2026-08-11T12:00:00.000+00:00',
      tenantId: 'tenant_northstar',
      aggregateId: 'blueprint_supplier-onboarding',
      idempotencyKey: 'approve:supplier-onboarding:v1',
      correlationId: '067c99d3-d9b4-4ed3-97d1-4fa10d188d52',
      causationId: null,
      traceparent: null,
      payload: {},
    });

    expect(result.success).toBe(true);
  });

  it('rejects an unscoped tenant identifier', () => {
    expect(tenantIdSchema.safeParse('northstar').success).toBe(false);
  });
});
