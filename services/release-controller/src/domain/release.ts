import type { ReleaseId, TenantId } from '@helixworks/contracts';

export const environments = ['local', 'dev', 'staging', 'prod'] as const;
export type Environment = (typeof environments)[number];
export type ArtifactDigest = `sha256:${string}`;

export interface ReleaseState {
  readonly tenantId: TenantId;
  readonly releaseId: ReleaseId;
  readonly artifactDigest: ArtifactDigest;
  readonly deployments: Readonly<Partial<Record<Environment, ArtifactDigest>>>;
}

export class ReleaseConflictError extends Error {}
export class PromotionOrderError extends Error {}

export function preparePromotion(
  current: ReleaseState | null,
  actualPreviousArtifactDigest: ArtifactDigest | null,
  input: {
    tenantId: TenantId;
    releaseId: ReleaseId;
    environment: Environment;
    artifactDigest: ArtifactDigest;
    expectedPreviousArtifactDigest: ArtifactDigest | null;
  },
): { next: ReleaseState; previousArtifactDigest: ArtifactDigest | null } {
  if (actualPreviousArtifactDigest !== input.expectedPreviousArtifactDigest) {
    throw new ReleaseConflictError('The environment changed after the promotion was prepared');
  }

  if (current !== null && current.artifactDigest !== input.artifactDigest) {
    throw new ReleaseConflictError('A release must promote the same immutable artifact digest');
  }

  const targetIndex = environments.indexOf(input.environment);
  if (targetIndex > 0) {
    const prerequisite = environments[targetIndex - 1];
    if (prerequisite === undefined || current?.deployments[prerequisite] !== input.artifactDigest) {
      throw new PromotionOrderError(`Promote the digest to ${prerequisite ?? 'local'} first`);
    }
  }

  return {
    previousArtifactDigest: actualPreviousArtifactDigest,
    next: {
      tenantId: input.tenantId,
      releaseId: input.releaseId,
      artifactDigest: input.artifactDigest,
      deployments: { ...current?.deployments, [input.environment]: input.artifactDigest },
    },
  };
}
