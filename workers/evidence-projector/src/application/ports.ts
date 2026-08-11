import type { TenantId } from '@helixworks/contracts';
import type { EvidenceRecord } from '../domain/evidence.js';

export interface EvidenceProjectionWriter {
  append(record: EvidenceRecord): Promise<void>;
}

export interface EvidenceProjectionReader {
  byCorrelation(tenantId: TenantId, correlationId: string): Promise<readonly EvidenceRecord[]>;
}
