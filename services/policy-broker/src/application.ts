import type { ConnectorId, RunId, TenantId } from '@helixworks/contracts';
import type { Clock, IdGenerator, OutboxRecord } from '@helixworks/service-kit';
import { claimMatchesGrant, type CapabilityClaim, type CapabilityGrant } from './domain.js';
import type { AuditSink, CapabilityRepository } from './ports.js';

interface IssueCapabilityCommand {
  readonly tenantId: TenantId;
  readonly runId: RunId;
  readonly connectorId: ConnectorId;
  readonly capability: string;
  readonly resource: string;
  readonly argumentDigest: string;
  readonly ttlSeconds: number;
}

export interface Decision {
  readonly decisionId: string;
  readonly allowed: boolean;
}

export class IssueCapability {
  public constructor(
    private readonly repository: CapabilityRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(command: IssueCapabilityCommand): Promise<CapabilityGrant> {
    if (
      !Number.isInteger(command.ttlSeconds) ||
      command.ttlSeconds < 1 ||
      command.ttlSeconds > 300
    ) {
      throw new Error('Capability lifetime must be between 1 and 300 seconds');
    }
    const issuedAt = this.clock.now();
    const grant: CapabilityGrant = {
      id: `capability_${this.ids.next()}`,
      tenantId: command.tenantId,
      runId: command.runId,
      connectorId: command.connectorId,
      capability: command.capability,
      resource: command.resource,
      argumentDigest: command.argumentDigest,
      issuedAt,
      expiresAt: new Date(issuedAt.getTime() + command.ttlSeconds * 1_000),
      revokedAt: null,
    };
    await this.repository.save(grant);
    return grant;
  }
}

export class DecideCapability {
  public constructor(
    private readonly repository: CapabilityRepository,
    private readonly audit: AuditSink,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(claim: CapabilityClaim): Promise<Decision> {
    const decisionId = `decision_${this.ids.next()}`;
    const now = this.clock.now();
    const grant = await this.repository.findById(claim.capabilityId);
    let reason = 'grant_not_found';
    let allowed = false;
    if (grant !== null && !claimMatchesGrant(claim, grant)) {
      reason = 'claim_mismatch';
    } else if (grant !== null && grant.revokedAt !== null) {
      reason = 'revoked';
    } else if (grant !== null && grant.expiresAt.getTime() <= now.getTime()) {
      reason = 'expired';
    } else if (grant !== null) {
      reason = 'allowed';
      allowed = true;
    }
    await this.audit.record({
      decisionId,
      tenantId: claim.tenantId,
      capabilityId: claim.capabilityId,
      allowed,
      reason,
      occurredAt: now,
    });
    return { decisionId, allowed };
  }
}

export class RevokeCapability {
  public constructor(
    private readonly repository: CapabilityRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(input: {
    readonly tenantId: TenantId;
    readonly capabilityId: string;
    readonly reason: string;
    readonly correlationId: string;
  }): Promise<boolean> {
    const revokedAt = this.clock.now();
    const eventId = this.ids.next();
    const event = {
      eventId,
      eventType: 'CapabilityRevoked.v1',
      schemaVersion: 1,
      occurredAt: revokedAt.toISOString(),
      tenantId: input.tenantId,
      aggregateId: input.capabilityId,
      idempotencyKey: `revoke:${input.capabilityId}`,
      correlationId: input.correlationId,
      causationId: null,
      traceparent: null,
      payload: {
        capabilityId: input.capabilityId,
        revokedAt: revokedAt.toISOString(),
        reason: input.reason,
      },
    } as const;
    const outbox: OutboxRecord = {
      id: eventId,
      tenantId: input.tenantId,
      event,
      createdAt: revokedAt,
      publishedAt: null,
      attempts: 0,
    };
    return this.repository.revokeWithOutbox(input.capabilityId, input.tenantId, revokedAt, outbox);
  }
}
