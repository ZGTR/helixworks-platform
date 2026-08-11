import { createHash } from 'node:crypto';
import type { ConnectorId, RunId, TenantId } from '@helixworks/contracts';

export interface SupplierRecord {
  readonly externalId: string;
  readonly legalName: string;
  readonly contactEmail: string;
  readonly countryCode: string;
  readonly status: 'pending_review' | 'active' | 'suspended';
}

export type SupplierOperation =
  | {
      readonly type: 'supplier.create';
      readonly supplier: Omit<SupplierRecord, 'status'>;
    }
  | {
      readonly type: 'supplier.status.set';
      readonly externalId: string;
      readonly status: SupplierRecord['status'];
    };

export interface ExecuteSupplierCommand {
  readonly commandId: string;
  readonly tenantId: TenantId;
  readonly runId: RunId;
  readonly connectorId: ConnectorId;
  readonly capabilityId: string;
  readonly credentialReference: string;
  readonly operation: SupplierOperation;
}

export interface SupplierExecutionResult {
  readonly operationId: string;
  readonly supplier: SupplierRecord;
}

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
};

export const argumentDigest = (operation: SupplierOperation): string =>
  `sha256:${createHash('sha256')
    .update(JSON.stringify(canonicalize(operation)))
    .digest('hex')}`;

export const resourceFor = (operation: SupplierOperation): string =>
  `supplier/${operation.type === 'supplier.create' ? operation.supplier.externalId : operation.externalId}`;
