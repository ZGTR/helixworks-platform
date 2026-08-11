import type {
  ApproveBlueprintCommand,
  BlueprintApprovedV1,
  RequestContext,
} from '@helixworks/contracts';
import type { Clock, IdGenerator } from '@helixworks/service-kit';
import { approveBlueprint, BlueprintConflictError } from '../domain/blueprint.js';
import type { BlueprintRepository, BlueprintUnitOfWork } from './ports.js';

export class BlueprintAccessDeniedError extends Error {}

export class ApproveBlueprintUseCase {
  public constructor(
    private readonly repository: BlueprintRepository,
    private readonly unitOfWork: BlueprintUnitOfWork,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(context: RequestContext, command: ApproveBlueprintCommand) {
    if (!context.roles.includes('blueprint:approve')) {
      throw new BlueprintAccessDeniedError('Subject cannot approve blueprints');
    }
    const visible = await this.repository.find(
      context.tenantId,
      command.blueprintId,
      command.version,
    );
    if (visible !== null) return visible;
    const collision = await this.repository.findAnyTenant(command.blueprintId, command.version);
    if (collision !== null) throw new BlueprintAccessDeniedError('Blueprint is not available');

    const approved = approveBlueprint(
      context.tenantId,
      command,
      context.subjectId,
      this.clock.now(),
    );
    const eventId = this.ids.next();
    const event: BlueprintApprovedV1 = {
      eventId,
      eventType: 'BlueprintApproved.v1',
      schemaVersion: 1,
      occurredAt: approved.approvedAt.toISOString(),
      tenantId: context.tenantId,
      aggregateId: command.blueprintId,
      idempotencyKey: `${context.tenantId}:${command.blueprintId}:${command.version}:approved`,
      correlationId: context.correlationId,
      causationId: null,
      traceparent: null,
      payload: {
        blueprintId: command.blueprintId,
        projectId: command.projectId,
        digest: approved.digest,
        approvedBy: context.subjectId,
      },
    };
    try {
      await this.unitOfWork.commit(approved, event);
    } catch (error: unknown) {
      if (error instanceof BlueprintConflictError) {
        const concurrent = await this.repository.find(
          context.tenantId,
          command.blueprintId,
          command.version,
        );
        if (concurrent !== null) return concurrent;
      }
      throw error;
    }
    return approved;
  }
}
