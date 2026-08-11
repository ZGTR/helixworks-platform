import {
  deploymentPromotedV1Schema,
  type DeploymentPromotedV1,
  type ReleaseId,
  type TenantId,
} from '@helixworks/contracts';
import type { Clock, IdGenerator } from '@helixworks/service-kit';
import { preparePromotion, type ArtifactDigest, type Environment } from '../domain/release.js';
import type { CanaryEvaluator, DeploymentGateway, ReleaseRepository } from './ports.js';

export class CanaryRejectedError extends Error {}

export interface PromoteReleaseCommand {
  readonly tenantId: TenantId;
  readonly releaseId: ReleaseId;
  readonly environment: Environment;
  readonly artifactDigest: ArtifactDigest;
  readonly expectedPreviousArtifactDigest: ArtifactDigest | null;
  readonly correlationId: string;
  readonly causationId: string | null;
}

export class PromoteRelease {
  public constructor(
    private readonly releases: ReleaseRepository,
    private readonly deployments: DeploymentGateway,
    private readonly canaries: CanaryEvaluator,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(command: PromoteReleaseCommand): Promise<DeploymentPromotedV1> {
    const current = await this.releases.find(command.tenantId, command.releaseId);
    const currentDeployment = await this.releases.currentDeployment(
      command.tenantId,
      command.environment,
    );
    const promotion = preparePromotion(current, currentDeployment, command);
    await this.deployments.deploy(command);

    const decision = await this.canaries.evaluate(command);
    if (!decision.approved) {
      await this.deployments.rollback({
        tenantId: command.tenantId,
        releaseId: command.releaseId,
        environment: command.environment,
        previousArtifactDigest: promotion.previousArtifactDigest,
      });
      throw new CanaryRejectedError(`Canary rejected promotion: ${decision.reason}`);
    }

    const event = deploymentPromotedV1Schema.parse({
      eventId: this.ids.next(),
      eventType: 'DeploymentPromoted.v1',
      schemaVersion: 1,
      occurredAt: this.clock.now().toISOString(),
      tenantId: command.tenantId,
      aggregateId: command.releaseId,
      idempotencyKey: `${command.tenantId}:${command.releaseId}:${command.environment}:${command.artifactDigest}`,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceparent: null,
      payload: {
        releaseId: command.releaseId,
        environment: command.environment,
        artifactDigest: command.artifactDigest,
        previousArtifactDigest: promotion.previousArtifactDigest,
      },
    });
    await this.releases.saveWithEvent(promotion.next, event);
    return event;
  }
}
