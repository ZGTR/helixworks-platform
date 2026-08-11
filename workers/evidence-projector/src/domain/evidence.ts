import type { TenantId } from '@helixworks/contracts';

export interface EvidenceRecord {
  readonly tenantId: TenantId;
  readonly eventId: string;
  readonly eventType: string;
  readonly occurredAt: string;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly aggregateId: string;
  readonly runId: string | null;
  readonly decisionId: string | null;
  readonly artifactId: string | null;
  readonly releaseId: string | null;
}

export function copyEvidence(record: EvidenceRecord): EvidenceRecord {
  return Object.freeze({ ...record });
}
