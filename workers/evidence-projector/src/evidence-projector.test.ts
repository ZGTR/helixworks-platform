import { tenantIdSchema } from '@helixworks/contracts';
import { describe, expect, it } from 'vitest';
import { createEvidenceProjectorComposition } from './composition-root.js';

const tenantA = tenantIdSchema.parse('tenant_alpha-01');
const tenantB = tenantIdSchema.parse('tenant_bravo-02');
const correlationId = '20000000-0000-4000-8000-000000000001';

const event = (tenantId: typeof tenantA, eventId: string) => ({
  eventId,
  eventType: 'AuthorizationDecided.v1',
  schemaVersion: 1,
  occurredAt: '2026-08-11T12:00:00.000Z',
  tenantId,
  aggregateId: 'run_helix-01',
  idempotencyKey: 'authorization:run_helix-01',
  correlationId,
  causationId: null,
  traceparent: null,
  payload: {
    runId: 'run_helix-01',
    decisionId: 'decision_helix-01',
    artifactId: 'artifact_helix-01',
    releaseId: 'release_helix-01',
    connectorSecret: 'must-never-be-projected',
    credentialBytes: 'also-forbidden',
  },
});

describe('evidence projector', () => {
  it('correlates allowlisted identifiers without retaining secrets', async () => {
    const worker = createEvidenceProjectorComposition();
    await worker.projectEvidence.handle(event(tenantA, '20000000-0000-4000-8000-000000000002'));

    const records = await worker.evidence.byCorrelation(tenantA, correlationId);
    expect(records).toEqual([
      expect.objectContaining({
        tenantId: tenantA,
        runId: 'run_helix-01',
        decisionId: 'decision_helix-01',
        artifactId: 'artifact_helix-01',
        releaseId: 'release_helix-01',
      }),
    ]);
    expect(JSON.stringify(records)).not.toContain('must-never-be-projected');
    expect(JSON.stringify(records)).not.toContain('credentialBytes');
  });

  it('ignores duplicate delivery through the idempotent inbox', async () => {
    const worker = createEvidenceProjectorComposition();
    const input = event(tenantA, '20000000-0000-4000-8000-000000000002');

    await expect(worker.projectEvidence.handle(input)).resolves.toBe(true);
    await expect(worker.projectEvidence.handle(input)).resolves.toBe(false);
    expect(await worker.evidence.byCorrelation(tenantA, correlationId)).toHaveLength(1);
  });

  it('isolates projections and inbox claims across tenants', async () => {
    const worker = createEvidenceProjectorComposition();
    await worker.projectEvidence.handle(event(tenantA, '20000000-0000-4000-8000-000000000002'));
    await worker.projectEvidence.handle(event(tenantB, '20000000-0000-4000-8000-000000000003'));

    expect(await worker.evidence.byCorrelation(tenantA, correlationId)).toHaveLength(1);
    expect(await worker.evidence.byCorrelation(tenantB, correlationId)).toHaveLength(1);
  });
});
