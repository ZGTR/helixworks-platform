import type { EventEnvelope, TenantId } from '@helixworks/contracts';
import type { OutboxRecord } from '@helixworks/service-kit';
import type { CapabilityGrant } from './domain.js';

export interface CapabilityRepository {
  save(grant: CapabilityGrant): Promise<void>;
  findById(id: string): Promise<CapabilityGrant | null>;
  revokeWithOutbox(
    id: string,
    tenantId: TenantId,
    revokedAt: Date,
    record: OutboxRecord,
  ): Promise<boolean>;
}

export interface AuditSink {
  record(entry: {
    readonly decisionId: string;
    readonly tenantId: TenantId;
    readonly capabilityId: string;
    readonly allowed: boolean;
    readonly reason: string;
    readonly occurredAt: Date;
  }): Promise<void>;
}

export const CAPABILITY_REPOSITORY = Symbol('CAPABILITY_REPOSITORY');
export const AUDIT_SINK = Symbol('AUDIT_SINK');
export const CLOCK = Symbol('CLOCK');
export const ID_GENERATOR = Symbol('ID_GENERATOR');

export type CapabilityRevokedEvent = Extract<EventEnvelope, { eventType: string }>;
