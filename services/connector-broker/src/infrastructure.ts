import type { TenantId } from '@helixworks/contracts';
import type { ConnectorExecutionRepository, PolicyDecisionPort, SupplierGateway } from './ports.js';
import type { SupplierExecutionResult } from './domain.js';

export class InMemoryConnectorExecutionRepository implements ConnectorExecutionRepository {
  readonly #executions = new Map<string, Promise<SupplierExecutionResult>>();

  public async executeOnce(
    tenantId: TenantId,
    commandId: string,
    action: () => Promise<SupplierExecutionResult>,
  ): Promise<{ readonly result: SupplierExecutionResult; readonly replayed: boolean }> {
    const key = `${tenantId}:${commandId}`;
    const existing = this.#executions.get(key);
    if (existing !== undefined) return { result: await existing, replayed: true };
    const pending = action();
    this.#executions.set(key, pending);
    try {
      return { result: await pending, replayed: false };
    } catch (error: unknown) {
      this.#executions.delete(key);
      throw error;
    }
  }
}

export class HttpPolicyDecisionClient implements PolicyDecisionPort {
  public constructor(
    private readonly baseUrl: string,
    private readonly serviceToken: string,
  ) {}

  public async authorize(input: Parameters<PolicyDecisionPort['authorize']>[0]) {
    const response = await fetch(`${this.baseUrl}/v1/capabilities/decisions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.serviceToken}`,
        'content-type': 'application/json',
        'x-authenticated-tenant': input.tenantId,
        'x-correlation-id': input.correlationId,
      },
      body: JSON.stringify({
        capabilityId: input.capabilityId,
        runId: input.runId,
        connectorId: input.connectorId,
        capability: input.capability,
        resource: input.resource,
        argumentDigest: input.argumentDigest,
      }),
    });
    if (!response.ok) return { decisionId: 'decision_policy-unavailable', allowed: false } as const;
    const value: unknown = await response.json();
    if (
      value === null ||
      typeof value !== 'object' ||
      !('decisionId' in value) ||
      typeof value.decisionId !== 'string' ||
      !('allowed' in value) ||
      typeof value.allowed !== 'boolean'
    ) {
      return { decisionId: 'decision_invalid-policy-response', allowed: false } as const;
    }
    return { decisionId: value.decisionId, allowed: value.allowed };
  }
}

export class HttpSupplierGateway implements SupplierGateway {
  public constructor(private readonly baseUrl: string) {}

  public async execute(input: Parameters<SupplierGateway['execute']>[0]) {
    const response = await fetch(`${this.baseUrl}/v1/supplier-operations`, {
      method: 'POST',
      signal: input.signal,
      headers: {
        'content-type': 'application/json',
        'x-tenant-id': input.tenantId,
        'x-credential-reference': input.credentialReference,
      },
      body: JSON.stringify(input.operation),
    });
    if (!response.ok) throw new Error('Upstream supplier connector rejected the operation');
    const value: unknown = await response.json();
    if (
      value === null ||
      typeof value !== 'object' ||
      !('operationId' in value) ||
      !('supplier' in value)
    ) {
      throw new Error('Upstream supplier connector returned an invalid response');
    }
    return value as SupplierExecutionResult;
  }
}
