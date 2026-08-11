import { describe, expect, it } from 'vitest';
import type { BlueprintApprovedV1, RequestContext, StartRunCommand } from '@helixworks/contracts';
import { InMemoryOutboxRepository, type Clock, type IdGenerator } from '@helixworks/service-kit';
import {
  BlueprintNotApprovedError,
  RunNotFoundError,
  RunUseCases,
} from './application/run-use-cases.js';
import { InvalidRunStateError, RunBudgetExceededError } from './domain/run.js';
import { ApprovedBlueprintProjection, InMemoryRunStore } from './infrastructure/in-memory-runs.js';

const digest = `sha256:${'a'.repeat(64)}`;
const context = {
  tenantId: 'tenant_northstar',
  subjectId: 'runner_alice',
  roles: ['run:start'],
  correlationId: '067c99d3-d9b4-4ed3-97d1-4fa10d188d52',
} as RequestContext;
const command = {
  blueprintId: 'blueprint_onboarding',
  blueprintDigest: digest,
  maxSteps: 2,
  maxCostUsd: 1,
} as StartRunCommand;
const approval = {
  eventId: '3edbb60d-754f-45fa-a6cf-8d7ef35e9992',
  eventType: 'BlueprintApproved.v1',
  schemaVersion: 1,
  occurredAt: '2026-08-11T12:00:00.000Z',
  tenantId: context.tenantId,
  aggregateId: command.blueprintId,
  idempotencyKey: 'approval-event-key',
  correlationId: context.correlationId,
  causationId: null,
  traceparent: null,
  payload: {
    blueprintId: command.blueprintId,
    projectId: 'project_supplier',
    digest,
    approvedBy: 'user_alice',
  },
} as BlueprintApprovedV1;

function fixture(approved = true) {
  const outbox = new InMemoryOutboxRepository();
  const store = new InMemoryRunStore(outbox);
  const projection = new ApprovedBlueprintProjection();
  if (approved) projection.apply(approval);
  let sequence = 0;
  const ids: IdGenerator = {
    next: () =>
      sequence++ === 0
        ? '90b0dd9b-6c64-4223-9ea0-11b67dafb100'
        : 'd24f6572-d75c-40c3-9bb7-34c6b8674776',
  };
  const clock: Clock = { now: () => new Date('2026-08-11T13:00:00.000Z') };
  return { outbox, useCases: new RunUseCases(projection, store, store, clock, ids) };
}

describe('bounded run orchestration', () => {
  it('starts only an approved digest and emits completion with immutable artifact digest', async () => {
    const { useCases, outbox } = fixture();
    const run = await useCases.start(context, command);
    await useCases.consume(context, run.snapshot().runId, 0.4);
    const completed = await useCases.complete(
      context,
      run.snapshot().runId,
      'artifact_supplier-app' as never,
      '{"release":"v1"}',
    );
    expect(completed.state).toBe('completed');
    expect(completed.artifactDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect((await outbox.pending(10))[0]?.event.eventType).toBe('RunCompleted.v1');
  });

  it('rejects an unapproved digest', async () => {
    await expect(fixture(false).useCases.start(context, command)).rejects.toBeInstanceOf(
      BlueprintNotApprovedError,
    );
  });

  it('hides another tenant run', async () => {
    const { useCases } = fixture();
    const run = await useCases.start(context, command);
    const other = { ...context, tenantId: 'tenant_contoso' } as RequestContext;
    await expect(useCases.consume(other, run.snapshot().runId, 0.1)).rejects.toBeInstanceOf(
      RunNotFoundError,
    );
  });

  it('enforces cost and step budgets without consuming the failed step', async () => {
    const { useCases } = fixture();
    const run = await useCases.start(context, command);
    await useCases.consume(context, run.snapshot().runId, 0.75);
    await expect(useCases.consume(context, run.snapshot().runId, 0.26)).rejects.toBeInstanceOf(
      RunBudgetExceededError,
    );
    expect(run.snapshot()).toMatchObject({ stepsUsed: 1, costUsd: 0.75, state: 'running' });
  });

  it('supports cancellation compensation and rejects invalid transitions', async () => {
    const { useCases } = fixture();
    const run = await useCases.start(context, command);
    await expect(useCases.compensate(context, run.snapshot().runId)).rejects.toBeInstanceOf(
      InvalidRunStateError,
    );
    await useCases.cancel(context, run.snapshot().runId);
    await expect(useCases.consume(context, run.snapshot().runId, 0.1)).rejects.toBeInstanceOf(
      InvalidRunStateError,
    );
    await expect(useCases.compensate(context, run.snapshot().runId)).resolves.toMatchObject({
      state: 'compensated',
    });
  });
});
