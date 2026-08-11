import type { TenantId } from '@helixworks/contracts';
import type { EvidenceProjectionReader, EvidenceProjectionWriter } from '../application/ports.js';
import { copyEvidence, type EvidenceRecord } from '../domain/evidence.js';

export class InMemoryEvidenceProjection
  implements EvidenceProjectionReader, EvidenceProjectionWriter
{
  readonly #records: EvidenceRecord[] = [];

  public append(record: EvidenceRecord): Promise<void> {
    this.#records.push(copyEvidence(record));
    return Promise.resolve();
  }

  public byCorrelation(
    tenantId: TenantId,
    correlationId: string,
  ): Promise<readonly EvidenceRecord[]> {
    return Promise.resolve(
      this.#records
        .filter((record) => record.tenantId === tenantId && record.correlationId === correlationId)
        .map(copyEvidence),
    );
  }
}
