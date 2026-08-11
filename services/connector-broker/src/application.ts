import type { ExecuteSupplierCommand, SupplierExecutionResult } from './domain.js';
import { argumentDigest, resourceFor } from './domain.js';
import type { ConnectorExecutionRepository, PolicyDecisionPort, SupplierGateway } from './ports.js';

export class ConnectorCommandRejected extends Error {
  public constructor(public readonly decisionId: string) {
    super('Connector command was not authorized');
  }
}

export class ConnectorUnavailable extends Error {
  public constructor() {
    super('Connector execution failed');
  }
}

export interface ExecuteResult {
  readonly result: SupplierExecutionResult;
  readonly replayed: boolean;
}

export class ExecuteSupplierOperation {
  public constructor(
    private readonly policy: PolicyDecisionPort,
    private readonly gateway: SupplierGateway,
    private readonly executions: ConnectorExecutionRepository,
    private readonly timeoutMs: number,
  ) {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
      throw new Error('Connector timeout must be between 1 and 30000 milliseconds');
    }
  }

  public async execute(
    command: ExecuteSupplierCommand,
    correlationId: string,
  ): Promise<ExecuteResult> {
    return this.executions.executeOnce(command.tenantId, command.commandId, async () => {
      const decision = await this.policy.authorize({
        capabilityId: command.capabilityId,
        tenantId: command.tenantId,
        runId: command.runId,
        connectorId: command.connectorId,
        capability: command.operation.type,
        resource: resourceFor(command.operation),
        argumentDigest: argumentDigest(command.operation),
        correlationId,
      });
      if (!decision.allowed) throw new ConnectorCommandRejected(decision.decisionId);

      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), this.timeoutMs);
      try {
        const result = await this.gateway.execute({
          tenantId: command.tenantId,
          credentialReference: command.credentialReference,
          operation: command.operation,
          signal: abort.signal,
        });
        return result;
      } catch (error: unknown) {
        if (error instanceof ConnectorCommandRejected) throw error;
        throw new ConnectorUnavailable();
      } finally {
        clearTimeout(timer);
      }
    });
  }
}
