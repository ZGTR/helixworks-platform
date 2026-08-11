import type { ConnectorId, RunId, TenantId } from '@helixworks/contracts';
import type { SupplierExecutionResult, SupplierOperation } from './domain.js';

export interface PolicyDecisionPort {
  authorize(input: {
    readonly capabilityId: string;
    readonly tenantId: TenantId;
    readonly runId: RunId;
    readonly connectorId: ConnectorId;
    readonly capability: string;
    readonly resource: string;
    readonly argumentDigest: string;
    readonly correlationId: string;
  }): Promise<{ readonly decisionId: string; readonly allowed: boolean }>;
}

export interface SupplierGateway {
  execute(input: {
    readonly tenantId: TenantId;
    readonly credentialReference: string;
    readonly operation: SupplierOperation;
    readonly signal: AbortSignal;
  }): Promise<SupplierExecutionResult>;
}

export interface ConnectorExecutionRepository {
  executeOnce(
    tenantId: TenantId,
    commandId: string,
    action: () => Promise<SupplierExecutionResult>,
  ): Promise<{ readonly result: SupplierExecutionResult; readonly replayed: boolean }>;
}

export const POLICY_DECISION_PORT = Symbol('POLICY_DECISION_PORT');
export const SUPPLIER_GATEWAY = Symbol('SUPPLIER_GATEWAY');
export const EXECUTION_REPOSITORY = Symbol('EXECUTION_REPOSITORY');
