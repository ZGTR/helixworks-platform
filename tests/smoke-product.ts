import assert from 'node:assert/strict';
import type {
  ApproveBlueprintCommand,
  BlueprintApprovedV1,
  RequestContext,
  RunCompletedV1,
} from '@helixworks/contracts';
import {
  artifactIdSchema,
  connectorIdSchema,
  releaseIdSchema,
  runIdSchema,
  tenantIdSchema,
} from '@helixworks/contracts';
import { InMemoryOutboxRepository, type Clock, type IdGenerator } from '@helixworks/service-kit';
import { ApproveBlueprintUseCase } from '../services/control-plane/src/application/approve-blueprint.js';
import { InMemoryBlueprintStore } from '../services/control-plane/src/infrastructure/in-memory-blueprints.js';
import { RunUseCases } from '../services/run-orchestrator/src/application/run-use-cases.js';
import {
  ApprovedBlueprintProjection,
  InMemoryRunStore,
} from '../services/run-orchestrator/src/infrastructure/in-memory-runs.js';
import {
  DecideCapability,
  IssueCapability,
  RevokeCapability,
} from '../services/policy-broker/src/application.js';
import { InMemoryPolicyStore } from '../services/policy-broker/src/infrastructure.js';
import { ExecuteSupplierOperation } from '../services/connector-broker/src/application.js';
import {
  argumentDigest,
  type ExecuteSupplierCommand,
} from '../services/connector-broker/src/domain.js';
import { InMemoryConnectorExecutionRepository } from '../services/connector-broker/src/infrastructure.js';
import type {
  PolicyDecisionPort,
  SupplierGateway,
} from '../services/connector-broker/src/ports.js';
import {
  ConfigurableCanaryEvaluator,
  InMemoryReleaseRepository,
  RecordingDeploymentGateway,
} from '../services/release-controller/src/adapters/in-memory.js';
import {
  CanaryRejectedError,
  PromoteRelease,
} from '../services/release-controller/src/application/promote-release.js';
import { createEvidenceProjectorComposition } from '../workers/evidence-projector/src/composition-root.js';

class FixedClock implements Clock {
  public current = new Date('2026-08-11T12:00:00.000Z');

  public now(): Date {
    return this.current;
  }
}

class SequenceIds implements IdGenerator {
  #current = 0;

  public next(): string {
    this.#current += 1;
    return `10000000-0000-4000-8000-${this.#current.toString().padStart(12, '0')}`;
  }
}

const clock = new FixedClock();
const ids = new SequenceIds();
const tenantId = tenantIdSchema.parse('tenant_northstar');
const otherTenantId = tenantIdSchema.parse('tenant_contoso01');
const correlationId = '20000000-0000-4000-8000-000000000001';
const context: RequestContext = {
  tenantId,
  subjectId: 'user_procurement-owner',
  roles: ['blueprint:approve', 'run:start'],
  correlationId,
};

const blueprintCommand = {
  projectId: 'project_supplier',
  blueprintId: 'blueprint_onboarding',
  version: 1,
  workflow: {
    name: 'Supplier onboarding',
    purpose: 'Collect evidence and approve a supplier under enterprise policy',
    requiredApprovals: ['procurement', 'security', 'legal'],
    connectorCapabilities: ['supplier.create'],
  },
} as ApproveBlueprintCommand;

const blueprintOutbox = new InMemoryOutboxRepository();
const blueprintStore = new InMemoryBlueprintStore(blueprintOutbox);
const approveBlueprint = new ApproveBlueprintUseCase(blueprintStore, blueprintStore, clock, ids);
const approved = await approveBlueprint.execute(context, blueprintCommand);
const approvedEvent = (await blueprintOutbox.pending(10))[0]?.event as
  BlueprintApprovedV1 | undefined;
assert.ok(approvedEvent);

const runOutbox = new InMemoryOutboxRepository();
const runStore = new InMemoryRunStore(runOutbox);
const approvals = new ApprovedBlueprintProjection();
approvals.apply(approvedEvent);
const runs = new RunUseCases(approvals, runStore, runStore, clock, ids);
const run = await runs.start(context, {
  blueprintId: blueprintCommand.blueprintId,
  blueprintDigest: approved.digest,
  maxSteps: 10,
  maxCostUsd: 2,
});
await runs.consume(context, run.snapshot().runId, 0.4);
const artifactId = artifactIdSchema.parse('artifact_supplier01');
const completed = await runs.complete(
  context,
  run.snapshot().runId,
  artifactId,
  JSON.stringify({ application: 'supplier-portal', blueprintDigest: approved.digest }),
);
const completedEvent = (await runOutbox.pending(10))[0]?.event as RunCompletedV1 | undefined;
assert.ok(completedEvent);
assert.ok(completed.artifactDigest);

const policyStore = new InMemoryPolicyStore();
const issueCapability = new IssueCapability(policyStore, clock, ids);
const decideCapability = new DecideCapability(policyStore, policyStore, clock, ids);
const revokeCapability = new RevokeCapability(policyStore, clock, ids);
const connectorId = connectorIdSchema.parse('connector_supplier01');
const operation = {
  type: 'supplier.create' as const,
  supplier: {
    externalId: 'supplier-001',
    legalName: 'Example Components Ltd',
    contactEmail: 'security@example-components.test',
    countryCode: 'GB',
  },
};
const capability = await issueCapability.execute({
  tenantId,
  runId: runIdSchema.parse(run.snapshot().runId),
  connectorId,
  capability: operation.type,
  resource: 'supplier/supplier-001',
  argumentDigest: argumentDigest(operation),
  ttlSeconds: 60,
});

const policyPort: PolicyDecisionPort = {
  authorize: ({ correlationId: ignoredCorrelationId, ...claim }) => {
    void ignoredCorrelationId;
    return decideCapability.execute(claim);
  },
};
let supplierSideEffects = 0;
const supplierGateway: SupplierGateway = {
  execute: (input) => {
    if (input.operation.type !== 'supplier.create') {
      throw new Error('Smoke scenario expects a supplier.create operation');
    }
    supplierSideEffects += 1;
    return Promise.resolve({
      operationId: `operation-${supplierSideEffects}`,
      supplier: { ...input.operation.supplier, status: 'pending_review' },
    });
  },
};
const executeConnector = new ExecuteSupplierOperation(
  policyPort,
  supplierGateway,
  new InMemoryConnectorExecutionRepository(),
  1_000,
);
const connectorCommand: ExecuteSupplierCommand = {
  commandId: '30000000-0000-4000-8000-000000000001',
  tenantId,
  runId: runIdSchema.parse(run.snapshot().runId),
  connectorId,
  capabilityId: capability.id,
  credentialReference: 'aws-sm://helixworks/dev/supplier-api',
  operation,
};
const [firstConnectorResult, duplicateConnectorResult] = await Promise.all([
  executeConnector.execute(connectorCommand, correlationId),
  executeConnector.execute(connectorCommand, correlationId),
]);
assert.equal(firstConnectorResult.replayed, false);
assert.equal(duplicateConnectorResult.replayed, true);
assert.equal(supplierSideEffects, 1);

const crossTenantDecision = await decideCapability.execute({
  capabilityId: capability.id,
  tenantId: otherTenantId,
  runId: connectorCommand.runId,
  connectorId,
  capability: operation.type,
  resource: 'supplier/supplier-001',
  argumentDigest: argumentDigest(operation),
});
assert.equal(crossTenantDecision.allowed, false);

await revokeCapability.execute({
  tenantId,
  capabilityId: capability.id,
  reason: 'supplier workflow cancelled',
  correlationId,
});
const revokedDecision = await decideCapability.execute({
  capabilityId: capability.id,
  tenantId,
  runId: connectorCommand.runId,
  connectorId,
  capability: operation.type,
  resource: 'supplier/supplier-001',
  argumentDigest: argumentDigest(operation),
});
assert.equal(revokedDecision.allowed, false);

const releaseOutbox = new InMemoryOutboxRepository();
const releases = new InMemoryReleaseRepository(releaseOutbox);
const deployments = new RecordingDeploymentGateway();
const canaries = new ConfigurableCanaryEvaluator();
const promote = new PromoteRelease(releases, deployments, canaries, clock, ids);
const artifactDigest = completed.artifactDigest;
const priorDigest = `sha256:${'b'.repeat(64)}` as const;
const priorReleaseId = releaseIdSchema.parse('release_supplier-prior');
const releaseId = releaseIdSchema.parse('release_supplier01');
await promote.execute({
  tenantId,
  releaseId: priorReleaseId,
  environment: 'local',
  artifactDigest: priorDigest,
  expectedPreviousArtifactDigest: null,
  correlationId,
  causationId: completedEvent.eventId,
});
canaries.decision = { approved: false, reason: 'error budget exceeded' };
await assert.rejects(
  promote.execute({
    tenantId,
    releaseId,
    environment: 'local',
    artifactDigest,
    expectedPreviousArtifactDigest: priorDigest,
    correlationId,
    causationId: completedEvent.eventId,
  }),
  CanaryRejectedError,
);
assert.deepEqual(deployments.operations.at(-1), {
  action: 'rollback',
  tenantId,
  releaseId,
  environment: 'local',
  artifactDigest: priorDigest,
});

const evidence = createEvidenceProjectorComposition();
const facts = [
  approvedEvent,
  completedEvent,
  ...(await policyStore.pending(10)).map((record) => record.event),
  ...(await releaseOutbox.pending(10)).map((record) => record.event),
];
for (const fact of facts) {
  await evidence.projectEvidence.handle(fact);
  await evidence.projectEvidence.handle(fact);
}
const projected = await evidence.evidence.byCorrelation(tenantId, correlationId);
assert.equal(projected.length, facts.length);
assert.ok(!JSON.stringify(projected).includes('aws-sm://'));

console.log(
  JSON.stringify(
    {
      status: 'PASS',
      tenantId,
      blueprintDigest: approved.digest,
      runId: run.snapshot().runId,
      artifactDigest,
      connectorBusinessEffects: supplierSideEffects,
      crossTenantDecision: 'denied',
      revokedCapabilityDecision: 'denied',
      failedCanaryRecoveredDigest: priorDigest,
      correlatedEvidenceRecords: projected.length,
    },
    null,
    2,
  ),
);
