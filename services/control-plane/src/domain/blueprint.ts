import { createHash } from 'node:crypto';
import type {
  ApproveBlueprintCommand,
  BlueprintId,
  ProjectId,
  TenantId,
} from '@helixworks/contracts';

export class BlueprintConflictError extends Error {}

export interface ApprovedBlueprint {
  readonly tenantId: TenantId;
  readonly projectId: ProjectId;
  readonly blueprintId: BlueprintId;
  readonly version: number;
  readonly digest: string;
  readonly workflow: {
    readonly name: string;
    readonly purpose: string;
    readonly requiredApprovals: readonly ('procurement' | 'security' | 'legal')[];
    readonly connectorCapabilities: readonly string[];
  };
  readonly approvedBy: string;
  readonly approvedAt: Date;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function approveBlueprint(
  tenantId: TenantId,
  command: ApproveBlueprintCommand,
  approvedBy: string,
  approvedAt: Date,
): ApprovedBlueprint {
  const immutableDefinition = {
    tenantId,
    projectId: command.projectId,
    blueprintId: command.blueprintId,
    version: command.version,
    workflow: command.workflow,
  };
  const digest = `sha256:${createHash('sha256').update(canonical(immutableDefinition)).digest('hex')}`;
  return Object.freeze({
    ...immutableDefinition,
    workflow: Object.freeze({
      ...command.workflow,
      requiredApprovals: Object.freeze([...command.workflow.requiredApprovals]),
      connectorCapabilities: Object.freeze([...command.workflow.connectorCapabilities]),
    }),
    digest,
    approvedBy,
    approvedAt,
  });
}
