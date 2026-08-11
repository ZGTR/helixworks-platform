import { z } from 'zod';
import {
  artifactIdSchema,
  blueprintIdSchema,
  connectorIdSchema,
  projectIdSchema,
  runIdSchema,
  tenantIdSchema,
} from './ids.js';

export const requestContextSchema = z.object({
  tenantId: tenantIdSchema,
  subjectId: z.string().min(1).max(128),
  roles: z.array(z.string().min(1).max(80)).max(32),
  correlationId: z.string().uuid(),
});

export const approveBlueprintCommandSchema = z.object({
  projectId: projectIdSchema,
  blueprintId: blueprintIdSchema,
  version: z.number().int().positive(),
  workflow: z.object({
    name: z.string().min(3).max(120),
    purpose: z.string().min(10).max(1000),
    requiredApprovals: z.array(z.enum(['procurement', 'security', 'legal'])).min(1),
    connectorCapabilities: z.array(z.string().min(3).max(120)).max(20),
  }),
});

export const startRunCommandSchema = z.object({
  blueprintId: blueprintIdSchema,
  blueprintDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  maxSteps: z.number().int().min(1).max(100),
  maxCostUsd: z.number().positive().max(100),
});

export const authorizeConnectorCommandSchema = z.object({
  runId: runIdSchema,
  connectorId: connectorIdSchema,
  capability: z.string().min(3).max(120),
  resource: z.string().min(1).max(240),
  argumentDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
});

export const promoteArtifactCommandSchema = z.object({
  artifactId: artifactIdSchema,
  artifactDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  environment: z.enum(['local', 'dev', 'staging', 'prod']),
  expectedPreviousDigest: z
    .string()
    .regex(/^sha256:[a-f0-9]{64}$/)
    .nullable(),
});

export type RequestContext = z.infer<typeof requestContextSchema>;
export type ApproveBlueprintCommand = z.infer<typeof approveBlueprintCommandSchema>;
export type StartRunCommand = z.infer<typeof startRunCommandSchema>;
export type AuthorizeConnectorCommand = z.infer<typeof authorizeConnectorCommandSchema>;
export type PromoteArtifactCommand = z.infer<typeof promoteArtifactCommandSchema>;
