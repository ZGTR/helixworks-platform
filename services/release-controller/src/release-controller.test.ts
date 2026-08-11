import { releaseIdSchema, tenantIdSchema } from '@helixworks/contracts';
import { InMemoryOutboxRepository, type Clock, type IdGenerator } from '@helixworks/service-kit';
import { describe, expect, it } from 'vitest';
import {
  ConfigurableCanaryEvaluator,
  InMemoryReleaseRepository,
  RecordingDeploymentGateway,
} from './adapters/in-memory.js';
import { CanaryRejectedError, PromoteRelease } from './application/promote-release.js';
import { ReleaseConflictError } from './domain/release.js';

const digestA = `sha256:${'a'.repeat(64)}` as const;
const digestB = `sha256:${'b'.repeat(64)}` as const;
const tenantA = tenantIdSchema.parse('tenant_alpha-01');
const tenantB = tenantIdSchema.parse('tenant_bravo-02');
const releaseId = releaseIdSchema.parse('release_helix-01');
const priorReleaseId = releaseIdSchema.parse('release_prior-01');
const correlationId = '10000000-0000-4000-8000-000000000001';

class FixedClock implements Clock {
  public now(): Date {
    return new Date('2026-08-11T12:00:00.000Z');
  }
}

class SequenceIds implements IdGenerator {
  #current = 0;

  public next(): string {
    this.#current += 1;
    return `10000000-0000-4000-8000-${this.#current.toString().padStart(12, '0')}`;
  }
}

function harness(): {
  useCase: PromoteRelease;
  repository: InMemoryReleaseRepository;
  deployments: RecordingDeploymentGateway;
  canaries: ConfigurableCanaryEvaluator;
  outbox: InMemoryOutboxRepository;
} {
  const outbox = new InMemoryOutboxRepository();
  const repository = new InMemoryReleaseRepository(outbox);
  const deployments = new RecordingDeploymentGateway();
  const canaries = new ConfigurableCanaryEvaluator();
  return {
    repository,
    deployments,
    canaries,
    outbox,
    useCase: new PromoteRelease(
      repository,
      deployments,
      canaries,
      new FixedClock(),
      new SequenceIds(),
    ),
  };
}

const command = (tenantId: typeof tenantA, environment: 'local' | 'dev') => ({
  tenantId,
  releaseId,
  environment,
  artifactDigest: digestA,
  expectedPreviousArtifactDigest: null,
  correlationId,
  causationId: null,
});

describe('release promotion', () => {
  it('promotes one immutable digest in environment order and writes an outbox event', async () => {
    const test = harness();

    await test.useCase.execute(command(tenantA, 'local'));
    const promoted = await test.useCase.execute(command(tenantA, 'dev'));

    expect(promoted.payload).toEqual({
      releaseId,
      environment: 'dev',
      artifactDigest: digestA,
      previousArtifactDigest: null,
    });
    expect(await test.outbox.pending(10)).toHaveLength(2);
    expect((await test.repository.find(tenantA, releaseId))?.deployments).toEqual({
      local: digestA,
      dev: digestA,
    });
  });

  it('isolates release state by tenant', async () => {
    const test = harness();
    await test.useCase.execute(command(tenantA, 'local'));

    await expect(
      test.useCase.execute({ ...command(tenantB, 'local'), artifactDigest: digestB }),
    ).resolves.toMatchObject({ tenantId: tenantB });
    expect((await test.repository.find(tenantA, releaseId))?.artifactDigest).toBe(digestA);
    expect((await test.repository.find(tenantB, releaseId))?.artifactDigest).toBe(digestB);
  });

  it('rejects stale expected state before deploying', async () => {
    const test = harness();
    await test.useCase.execute(command(tenantA, 'local'));

    await expect(
      test.useCase.execute({
        ...command(tenantA, 'local'),
        expectedPreviousArtifactDigest: digestB,
      }),
    ).rejects.toBeInstanceOf(ReleaseConflictError);
    expect(test.deployments.operations).toHaveLength(1);
  });

  it('rolls back to the prior digest when a canary fails without committing state', async () => {
    const test = harness();
    await test.useCase.execute({
      ...command(tenantA, 'local'),
      releaseId: priorReleaseId,
      artifactDigest: digestB,
    });
    test.canaries.decision = { approved: false, reason: 'error budget exceeded' };

    await expect(
      test.useCase.execute({
        ...command(tenantA, 'local'),
        expectedPreviousArtifactDigest: digestB,
      }),
    ).rejects.toBeInstanceOf(CanaryRejectedError);
    expect(test.deployments.operations.slice(-2)).toEqual([
      {
        action: 'deploy',
        tenantId: tenantA,
        releaseId,
        environment: 'local',
        artifactDigest: digestA,
      },
      {
        action: 'rollback',
        tenantId: tenantA,
        releaseId,
        environment: 'local',
        artifactDigest: digestB,
      },
    ]);
    expect(await test.outbox.pending(10)).toHaveLength(1);
    expect(await test.repository.find(tenantA, releaseId)).toBeNull();
  });
});
