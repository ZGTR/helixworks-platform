import { z } from 'zod';

const opaqueId = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[a-zA-Z0-9-]{6,64}$`));

export const tenantIdSchema = opaqueId('tenant').brand<'TenantId'>();
export const projectIdSchema = opaqueId('project').brand<'ProjectId'>();
export const blueprintIdSchema = opaqueId('blueprint').brand<'BlueprintId'>();
export const runIdSchema = opaqueId('run').brand<'RunId'>();
export const artifactIdSchema = opaqueId('artifact').brand<'ArtifactId'>();
export const decisionIdSchema = opaqueId('decision').brand<'DecisionId'>();
export const releaseIdSchema = opaqueId('release').brand<'ReleaseId'>();
export const connectorIdSchema = opaqueId('connector').brand<'ConnectorId'>();

export type TenantId = z.infer<typeof tenantIdSchema>;
export type ProjectId = z.infer<typeof projectIdSchema>;
export type BlueprintId = z.infer<typeof blueprintIdSchema>;
export type RunId = z.infer<typeof runIdSchema>;
export type ArtifactId = z.infer<typeof artifactIdSchema>;
export type DecisionId = z.infer<typeof decisionIdSchema>;
export type ReleaseId = z.infer<typeof releaseIdSchema>;
export type ConnectorId = z.infer<typeof connectorIdSchema>;
