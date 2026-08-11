import { z } from 'zod';
import { tenantIdSchema } from './ids.js';

export const eventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string().regex(/^[A-Z][A-Za-z]+\.v\d+$/),
  schemaVersion: z.number().int().positive(),
  occurredAt: z.string().datetime({ offset: true }),
  tenantId: tenantIdSchema,
  aggregateId: z.string().min(1).max(128),
  idempotencyKey: z.string().min(8).max(160),
  correlationId: z.string().uuid(),
  causationId: z.string().uuid().nullable(),
  traceparent: z.string().min(1).max(256).nullable(),
  payload: z.record(z.string(), z.unknown()),
});

export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;

export const blueprintApprovedV1Schema = eventEnvelopeSchema.extend({
  eventType: z.literal('BlueprintApproved.v1'),
  payload: z.object({
    blueprintId: z.string(),
    projectId: z.string(),
    digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    approvedBy: z.string().min(1),
  }),
});

export const runCompletedV1Schema = eventEnvelopeSchema.extend({
  eventType: z.literal('RunCompleted.v1'),
  payload: z.object({
    runId: z.string(),
    artifactId: z.string(),
    artifactDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  }),
});

export const deploymentPromotedV1Schema = eventEnvelopeSchema.extend({
  eventType: z.literal('DeploymentPromoted.v1'),
  payload: z.object({
    releaseId: z.string(),
    environment: z.enum(['local', 'dev', 'staging', 'prod']),
    artifactDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    previousArtifactDigest: z
      .string()
      .regex(/^sha256:[a-f0-9]{64}$/)
      .nullable(),
  }),
});

export const capabilityRevokedV1Schema = eventEnvelopeSchema.extend({
  eventType: z.literal('CapabilityRevoked.v1'),
  payload: z.object({
    capabilityId: z.string(),
    revokedAt: z.string().datetime({ offset: true }),
    reason: z.string().min(1).max(240),
  }),
});

export type BlueprintApprovedV1 = z.infer<typeof blueprintApprovedV1Schema>;
export type RunCompletedV1 = z.infer<typeof runCompletedV1Schema>;
export type DeploymentPromotedV1 = z.infer<typeof deploymentPromotedV1Schema>;
export type CapabilityRevokedV1 = z.infer<typeof capabilityRevokedV1Schema>;
