import type { ConnectorId, RunId, TenantId } from '@helixworks/contracts';

export interface CapabilityGrant {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly runId: RunId;
  readonly connectorId: ConnectorId;
  readonly capability: string;
  readonly resource: string;
  readonly argumentDigest: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  revokedAt: Date | null;
}

export interface CapabilityClaim {
  readonly capabilityId: string;
  readonly tenantId: TenantId;
  readonly runId: RunId;
  readonly connectorId: ConnectorId;
  readonly capability: string;
  readonly resource: string;
  readonly argumentDigest: string;
}

export const claimMatchesGrant = (claim: CapabilityClaim, grant: CapabilityGrant): boolean =>
  claim.capabilityId === grant.id &&
  claim.tenantId === grant.tenantId &&
  claim.runId === grant.runId &&
  claim.connectorId === grant.connectorId &&
  claim.capability === grant.capability &&
  claim.resource === grant.resource &&
  claim.argumentDigest === grant.argumentDigest;
