import { Module, type Type } from '@nestjs/common';
import { CryptoIdGenerator, InMemoryOutboxRepository, SystemClock } from '@helixworks/service-kit';
import {
  ConfigurableCanaryEvaluator,
  InMemoryReleaseRepository,
  RecordingDeploymentGateway,
} from './adapters/in-memory.js';
import { PromoteRelease } from './application/promote-release.js';
import { ReleaseController } from './http/release.controller.js';

export interface ReleaseControllerComposition {
  readonly module: Type<unknown>;
  readonly promoteRelease: PromoteRelease;
  readonly outbox: InMemoryOutboxRepository;
  readonly deployments: RecordingDeploymentGateway;
  readonly canaries: ConfigurableCanaryEvaluator;
}

export function createReleaseControllerComposition(): ReleaseControllerComposition {
  const outbox = new InMemoryOutboxRepository();
  const deployments = new RecordingDeploymentGateway();
  const canaries = new ConfigurableCanaryEvaluator();
  const releases = new InMemoryReleaseRepository(outbox);
  const promoteRelease = new PromoteRelease(
    releases,
    deployments,
    canaries,
    new SystemClock(),
    new CryptoIdGenerator(),
  );

  @Module({
    controllers: [ReleaseController],
    providers: [{ provide: PromoteRelease, useValue: promoteRelease }],
  })
  class ReleaseControllerModule {}

  return { module: ReleaseControllerModule, promoteRelease, outbox, deployments, canaries };
}
