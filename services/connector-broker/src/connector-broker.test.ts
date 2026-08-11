import { describe, expect, it, vi } from 'vitest';
import { connectorIdSchema, runIdSchema, tenantIdSchema } from '@helixworks/contracts';
import { ConnectorUnavailable, ExecuteSupplierOperation } from './application.js';
import { argumentDigest, type ExecuteSupplierCommand } from './domain.js';
import { InMemoryConnectorExecutionRepository } from './infrastructure.js';
import type { PolicyDecisionPort, SupplierGateway } from './ports.js';

const tenantId = tenantIdSchema.parse('tenant_alpha01');
const operation = {
  type: 'supplier.create',
  supplier: {
    externalId: 'acme',
    legalName: 'Acme Limited',
    contactEmail: 'buyer@acme.example',
    countryCode: 'GB',
  },
} as const;
const command: ExecuteSupplierCommand = {
  commandId: '10000000-0000-4000-8000-000000000001',
  tenantId,
  runId: runIdSchema.parse('run_supplier01'),
  connectorId: connectorIdSchema.parse('connector_erp001'),
  capabilityId: 'capability_10000000-0000-4000-8000-000000000001',
  credentialReference: 'aws-sm://helixworks/dev/supplier-api',
  operation,
};
const result = {
  operationId: 'supplier-operation-1',
  supplier: { ...operation.supplier, status: 'pending_review' as const },
};

const correlationId = '20000000-0000-4000-8000-000000000001';

describe('connector broker', () => {
  it('authorizes the internally derived exact arguments before execution', async () => {
    const authorize = vi.fn<PolicyDecisionPort['authorize']>().mockResolvedValue({
      decisionId: 'decision_allow01',
      allowed: true,
    });
    const execute = vi.fn<SupplierGateway['execute']>().mockResolvedValue(result);
    const useCase = new ExecuteSupplierOperation(
      { authorize },
      { execute },
      new InMemoryConnectorExecutionRepository(),
      100,
    );

    await expect(useCase.execute(command, correlationId)).resolves.toEqual({
      result,
      replayed: false,
    });
    expect(authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        resource: 'supplier/acme',
        capability: 'supplier.create',
        argumentDigest: argumentDigest(operation),
      }),
    );
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ credentialReference: command.credentialReference }),
    );
  });

  it('executes a duplicate connector command only once', async () => {
    const authorize = vi.fn<PolicyDecisionPort['authorize']>().mockResolvedValue({
      decisionId: 'decision_allow01',
      allowed: true,
    });
    const execute = vi.fn<SupplierGateway['execute']>().mockResolvedValue(result);
    const useCase = new ExecuteSupplierOperation(
      { authorize },
      { execute },
      new InMemoryConnectorExecutionRepository(),
      100,
    );

    const [first, second] = await Promise.all([
      useCase.execute(command, correlationId),
      useCase.execute(command, correlationId),
    ]);
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(authorize).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('redacts gateway errors and never returns credential material', async () => {
    const policy: PolicyDecisionPort = {
      authorize: vi.fn().mockResolvedValue({ decisionId: 'decision_allow01', allowed: true }),
    };
    const gateway: SupplierGateway = {
      execute: vi.fn().mockRejectedValue(new Error('upstream included super-secret-value')),
    };
    const useCase = new ExecuteSupplierOperation(
      policy,
      gateway,
      new InMemoryConnectorExecutionRepository(),
      100,
    );

    const captured = await useCase.execute(command, correlationId).catch((error: unknown) => error);
    expect(captured).toBeInstanceOf(ConnectorUnavailable);
    expect(String(captured)).not.toContain('super-secret-value');
    expect(String(captured)).not.toContain(command.credentialReference);
  });
});
