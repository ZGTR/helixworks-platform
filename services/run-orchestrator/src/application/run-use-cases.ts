import type {
  ArtifactId,
  RequestContext,
  RunCompletedV1,
  RunId,
  StartRunCommand,
} from '@helixworks/contracts';
import type { Clock, IdGenerator } from '@helixworks/service-kit';
import { Run } from '../domain/run.js';
import type { ApprovedBlueprintReader, RunRepository, RunUnitOfWork } from './ports.js';

export class BlueprintNotApprovedError extends Error {}
export class RunNotFoundError extends Error {}

export class RunUseCases {
  public constructor(
    private readonly blueprints: ApprovedBlueprintReader,
    private readonly runs: RunRepository,
    private readonly unitOfWork: RunUnitOfWork,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  public async start(context: RequestContext, command: StartRunCommand): Promise<Run> {
    if (
      !(await this.blueprints.isApproved(
        context.tenantId,
        command.blueprintId,
        command.blueprintDigest,
      ))
    ) {
      throw new BlueprintNotApprovedError('Approved blueprint digest required');
    }
    const runId = `run_${this.ids.next()}` as RunId;
    const run = new Run({
      tenantId: context.tenantId,
      runId,
      blueprintId: command.blueprintId,
      blueprintDigest: command.blueprintDigest,
      maxSteps: command.maxSteps,
      maxCostUsd: command.maxCostUsd,
    });
    await this.runs.save(run);
    return run;
  }

  public async consume(context: RequestContext, runId: RunId, costUsd: number) {
    const run = await this.get(context, runId);
    run.consume(costUsd);
    await this.runs.save(run);
    return run.snapshot();
  }

  public async complete(
    context: RequestContext,
    runId: RunId,
    artifactId: ArtifactId,
    artifact: string,
  ) {
    const run = await this.get(context, runId);
    const digest = run.complete(artifactId, artifact);
    const now = this.clock.now();
    const eventId = this.ids.next();
    const event: RunCompletedV1 = {
      eventId,
      eventType: 'RunCompleted.v1',
      schemaVersion: 1,
      occurredAt: now.toISOString(),
      tenantId: context.tenantId,
      aggregateId: runId,
      idempotencyKey: `${context.tenantId}:${runId}:completed`,
      correlationId: context.correlationId,
      causationId: null,
      traceparent: null,
      payload: { runId, artifactId, artifactDigest: digest },
    };
    await this.unitOfWork.complete(run, event);
    return run.snapshot();
  }

  public async cancel(context: RequestContext, runId: RunId) {
    const run = await this.get(context, runId);
    run.cancel();
    await this.runs.save(run);
    return run.snapshot();
  }
  public async compensate(context: RequestContext, runId: RunId) {
    const run = await this.get(context, runId);
    run.compensate();
    await this.runs.save(run);
    return run.snapshot();
  }
  private async get(context: RequestContext, id: RunId): Promise<Run> {
    const run = await this.runs.find(context.tenantId, id);
    if (run !== null) return run;
    if ((await this.runs.findAnyTenant(id)) !== null) throw new RunNotFoundError('Run not found');
    throw new RunNotFoundError('Run not found');
  }
}
