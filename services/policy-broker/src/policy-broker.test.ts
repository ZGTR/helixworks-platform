import { describe, expect, it } from 'vitest';
import {
  capabilityRevokedV1Schema,
  connectorIdSchema,
  runIdSchema,
  tenantIdSchema,
} from '@helixworks/contracts';
import type { Clock, IdGenerator } from '@helixworks/service-kit';
import { DecideCapability, IssueCapability, RevokeCapability } from './application.js';
import { InMemoryPolicyStore } from './infrastructure.js';

class MutableClock implements Clock {
  public constructor(public current: Date) {}
  public now(): Date {
    return this.current;
  }
}

class SequenceIds implements IdGenerator {
  #value = 0;
  public next(): string {
    this.#value += 1;
    return `00000000-0000-4000-8000-${this.#value.toString().padStart(12, '0')}`;
  }
}

const tenantA = tenantIdSchema.parse('tenant_alpha01');
const tenantB = tenantIdSchema.parse('tenant_bravo01');
const run = runIdSchema.parse('run_supplier01');
const connector = connectorIdSchema.parse('connector_erp001');
const digest = `sha256:${'a'.repeat(64)}`;

const setup = () => {
  const clock = new MutableClock(new Date('2026-08-11T12:00:00.000Z'));
  const ids = new SequenceIds();
  const store = new InMemoryPolicyStore();
  const issue = new IssueCapability(store, clock, ids);
  const decide = new DecideCapability(store, store, clock, ids);
  const revoke = new RevokeCapability(store, clock, ids);
  return { clock, store, issue, decide, revoke };
};

const issueGrant = (context: ReturnType<typeof setup>) =>
  context.issue.execute({
    tenantId: tenantA,
    runId: run,
    connectorId: connector,
    capability: 'supplier.create',
    resource: 'supplier/acme',
    argumentDigest: digest,
    ttlSeconds: 60,
  });

describe('policy broker', () => {
  it('allows only an exact, live capability claim', async () => {
    const context = setup();
    const grant = await issueGrant(context);

    await expect(
      context.decide.execute({
        capabilityId: grant.id,
        tenantId: tenantA,
        runId: run,
        connectorId: connector,
        capability: 'supplier.create',
        resource: 'supplier/acme',
        argumentDigest: digest,
      }),
    ).resolves.toMatchObject({ allowed: true });
  });

  it('fails closed for a cross-tenant confused-deputy claim', async () => {
    const context = setup();
    const grant = await issueGrant(context);

    const decision = await context.decide.execute({
      capabilityId: grant.id,
      tenantId: tenantB,
      runId: run,
      connectorId: connector,
      capability: 'supplier.create',
      resource: 'supplier/acme',
      argumentDigest: digest,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.decisionId).toMatch(/^decision_/);
    expect(decision).not.toHaveProperty('reason');
  });

  it('denies altered arguments under an otherwise valid capability', async () => {
    const context = setup();
    const grant = await issueGrant(context);
    const decision = await context.decide.execute({
      capabilityId: grant.id,
      tenantId: tenantA,
      runId: run,
      connectorId: connector,
      capability: 'supplier.create',
      resource: 'supplier/acme',
      argumentDigest: `sha256:${'b'.repeat(64)}`,
    });
    expect(decision.allowed).toBe(false);
  });

  it('denies expired capabilities', async () => {
    const context = setup();
    const grant = await issueGrant(context);
    context.clock.current = new Date('2026-08-11T12:01:00.000Z');
    const decision = await context.decide.execute({
      capabilityId: grant.id,
      tenantId: tenantA,
      runId: run,
      connectorId: connector,
      capability: 'supplier.create',
      resource: 'supplier/acme',
      argumentDigest: digest,
    });
    expect(decision.allowed).toBe(false);
  });

  it('atomically revokes a capability and records CapabilityRevoked.v1 in the outbox', async () => {
    const context = setup();
    const grant = await issueGrant(context);
    await context.revoke.execute({
      tenantId: tenantA,
      capabilityId: grant.id,
      reason: 'workflow cancelled',
      correlationId: '10000000-0000-4000-8000-000000000001',
    });
    const decision = await context.decide.execute({
      capabilityId: grant.id,
      tenantId: tenantA,
      runId: run,
      connectorId: connector,
      capability: 'supplier.create',
      resource: 'supplier/acme',
      argumentDigest: digest,
    });
    expect(decision.allowed).toBe(false);
    const pending = await context.store.pending(10);
    expect(pending).toHaveLength(1);
    expect(() => capabilityRevokedV1Schema.parse(pending[0]?.event)).not.toThrow();
  });
});
