import { InMemoryInboxRepository } from '@helixworks/service-kit';
import { InMemoryEvidenceProjection } from './adapters/in-memory-evidence-projection.js';
import { ProjectEvidence } from './application/project-evidence.js';

export interface EvidenceProjectorComposition {
  readonly projectEvidence: ProjectEvidence;
  readonly evidence: InMemoryEvidenceProjection;
}

export function createEvidenceProjectorComposition(): EvidenceProjectorComposition {
  const evidence = new InMemoryEvidenceProjection();
  return {
    evidence,
    projectEvidence: new ProjectEvidence(new InMemoryInboxRepository(), evidence),
  };
}
