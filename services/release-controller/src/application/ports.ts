import type { DeploymentPromotedV1, ReleaseId, TenantId } from '@helixworks/contracts';
import type { ArtifactDigest, Environment, ReleaseState } from '../domain/release.js';

export interface ReleaseRepository {
  find(tenantId: TenantId, releaseId: ReleaseId): Promise<ReleaseState | null>;
  currentDeployment(tenantId: TenantId, environment: Environment): Promise<ArtifactDigest | null>;
  saveWithEvent(state: ReleaseState, event: DeploymentPromotedV1): Promise<void>;
}

export interface DeploymentGateway {
  deploy(input: {
    tenantId: TenantId;
    releaseId: ReleaseId;
    environment: Environment;
    artifactDigest: ArtifactDigest;
  }): Promise<void>;
  rollback(input: {
    tenantId: TenantId;
    releaseId: ReleaseId;
    environment: Environment;
    previousArtifactDigest: ArtifactDigest | null;
  }): Promise<void>;
}

export interface CanaryDecision {
  readonly approved: boolean;
  readonly reason: string;
}

export interface CanaryEvaluator {
  evaluate(input: {
    tenantId: TenantId;
    releaseId: ReleaseId;
    environment: Environment;
    artifactDigest: ArtifactDigest;
  }): Promise<CanaryDecision>;
}
