import type { DeploymentPromotedV1, ReleaseId, TenantId } from '@helixworks/contracts';
import type { OutboxRepository } from '@helixworks/service-kit';
import type { ArtifactDigest, Environment, ReleaseState } from '../domain/release.js';
import type {
  CanaryDecision,
  CanaryEvaluator,
  DeploymentGateway,
  ReleaseRepository,
} from '../application/ports.js';

const releaseKey = (tenantId: TenantId, releaseId: ReleaseId): string => `${tenantId}:${releaseId}`;

export class InMemoryReleaseRepository implements ReleaseRepository {
  readonly #states = new Map<string, ReleaseState>();
  readonly #deployments = new Map<string, ArtifactDigest>();

  public constructor(private readonly outbox: OutboxRepository) {}

  public find(tenantId: TenantId, releaseId: ReleaseId): Promise<ReleaseState | null> {
    return Promise.resolve(this.#states.get(releaseKey(tenantId, releaseId)) ?? null);
  }

  public currentDeployment(
    tenantId: TenantId,
    environment: Environment,
  ): Promise<ArtifactDigest | null> {
    return Promise.resolve(this.#deployments.get(`${tenantId}:${environment}`) ?? null);
  }

  public async saveWithEvent(state: ReleaseState, event: DeploymentPromotedV1): Promise<void> {
    await this.outbox.append({
      id: event.eventId,
      tenantId: state.tenantId,
      event,
      createdAt: new Date(event.occurredAt),
      publishedAt: null,
      attempts: 0,
    });
    this.#states.set(releaseKey(state.tenantId, state.releaseId), state);
    const promotedEnvironment = event.payload.environment;
    this.#deployments.set(
      `${state.tenantId}:${promotedEnvironment}`,
      event.payload.artifactDigest as ArtifactDigest,
    );
  }
}

export interface DeploymentOperation {
  readonly action: 'deploy' | 'rollback';
  readonly tenantId: TenantId;
  readonly releaseId: ReleaseId;
  readonly environment: Environment;
  readonly artifactDigest: ArtifactDigest | null;
}

export class RecordingDeploymentGateway implements DeploymentGateway {
  public readonly operations: DeploymentOperation[] = [];

  public deploy(input: {
    tenantId: TenantId;
    releaseId: ReleaseId;
    environment: Environment;
    artifactDigest: ArtifactDigest;
  }): Promise<void> {
    this.operations.push({
      action: 'deploy',
      tenantId: input.tenantId,
      releaseId: input.releaseId,
      environment: input.environment,
      artifactDigest: input.artifactDigest,
    });
    return Promise.resolve();
  }

  public rollback(input: {
    tenantId: TenantId;
    releaseId: ReleaseId;
    environment: Environment;
    previousArtifactDigest: ArtifactDigest | null;
  }): Promise<void> {
    const { previousArtifactDigest, ...rest } = input;
    this.operations.push({ action: 'rollback', artifactDigest: previousArtifactDigest, ...rest });
    return Promise.resolve();
  }
}

export class ConfigurableCanaryEvaluator implements CanaryEvaluator {
  public constructor(public decision: CanaryDecision = { approved: true, reason: 'healthy' }) {}

  public evaluate(): Promise<CanaryDecision> {
    return Promise.resolve(this.decision);
  }
}
