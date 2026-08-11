import { describe, expect, it } from 'vitest';
import type { ApproveBlueprintCommand, RequestContext } from '@helixworks/contracts';
import { InMemoryOutboxRepository, type Clock, type IdGenerator } from '@helixworks/service-kit';
import {
  ApproveBlueprintUseCase,
  BlueprintAccessDeniedError,
} from './application/approve-blueprint.js';
import { InMemoryBlueprintStore } from './infrastructure/in-memory-blueprints.js';

const clock: Clock = { now: () => new Date('2026-08-11T12:00:00.000Z') };
const ids: IdGenerator = { next: () => '3edbb60d-754f-45fa-a6cf-8d7ef35e9992' };
const context = {
  tenantId: 'tenant_northstar',
  subjectId: 'user_alice',
  roles: ['blueprint:approve'],
  correlationId: '067c99d3-d9b4-4ed3-97d1-4fa10d188d52',
} as RequestContext;
const command = {
  projectId: 'project_supplier',
  blueprintId: 'blueprint_onboarding',
  version: 1,
  workflow: {
    name: 'Supplier onboarding',
    purpose: 'Assess and onboard enterprise suppliers safely',
    requiredApprovals: ['procurement', 'security'],
    connectorCapabilities: ['erp.read-supplier'],
  },
} as ApproveBlueprintCommand;

function fixture() {
  const outbox = new InMemoryOutboxRepository();
  const store = new InMemoryBlueprintStore(outbox);
  return { outbox, useCase: new ApproveBlueprintUseCase(store, store, clock, ids) };
}

describe('approve blueprint', () => {
  it('persists one immutable digest and its tenant-scoped outbox fact', async () => {
    const { useCase, outbox } = fixture();
    const approved = await useCase.execute(context, command);
    const records = await outbox.pending(10);
    expect(approved.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(records[0]?.event.eventType).toBe('BlueprintApproved.v1');
    expect(records[0]?.tenantId).toBe(context.tenantId);
    await expect(useCase.execute(context, command)).resolves.toBe(approved);
    expect(await outbox.pending(10)).toHaveLength(1);
  });

  it('does not reveal a blueprint owned by another tenant', async () => {
    const { useCase } = fixture();
    await useCase.execute(context, command);
    const other = { ...context, tenantId: 'tenant_contoso' } as RequestContext;
    await expect(useCase.execute(other, command)).rejects.toBeInstanceOf(
      BlueprintAccessDeniedError,
    );
  });

  it('rejects a subject without approval authority', async () => {
    const { useCase } = fixture();
    await expect(useCase.execute({ ...context, roles: [] }, command)).rejects.toBeInstanceOf(
      BlueprintAccessDeniedError,
    );
  });
});
