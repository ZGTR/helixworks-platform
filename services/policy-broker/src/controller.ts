import { Body, Controller, Get, HttpException, Inject, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { connectorIdSchema, runIdSchema, type RequestContext } from '@helixworks/contracts';
import { DecideCapability, IssueCapability, RevokeCapability } from './application.js';

interface AuthenticatedRequest {
  readonly auth?: RequestContext;
}

const grantSchema = z.object({
  runId: runIdSchema,
  connectorId: connectorIdSchema,
  capability: z.string().min(3).max(120),
  resource: z.string().min(1).max(240),
  argumentDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  ttlSeconds: z.number().int().min(1).max(300),
});
const decisionSchema = grantSchema
  .omit({ ttlSeconds: true })
  .extend({ capabilityId: z.string().min(1) });
const revokeSchema = z.object({
  capabilityId: z.string().min(1),
  reason: z.string().min(1).max(240),
});

const contextOf = (request: AuthenticatedRequest): RequestContext => {
  if (request.auth === undefined) throw new HttpException('Unauthenticated', 401);
  return request.auth;
};

@Controller('v1/capabilities')
export class PolicyController {
  public constructor(
    @Inject(IssueCapability) private readonly issue: IssueCapability,
    @Inject(DecideCapability) private readonly decide: DecideCapability,
    @Inject(RevokeCapability) private readonly revoke: RevokeCapability,
  ) {}

  @Post()
  public async issueCapability(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const auth = contextOf(request);
    const command = grantSchema.parse(body);
    const grant = await this.issue.execute({ tenantId: auth.tenantId, ...command });
    return { capabilityId: grant.id, expiresAt: grant.expiresAt.toISOString() };
  }

  @Post('decisions')
  public async decideCapability(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const auth = contextOf(request);
    return this.decide.execute({ tenantId: auth.tenantId, ...decisionSchema.parse(body) });
  }

  @Post('revoke')
  public async revokeCapability(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const auth = contextOf(request);
    const command = revokeSchema.parse(body);
    const revoked = await this.revoke.execute({
      tenantId: auth.tenantId,
      correlationId: auth.correlationId,
      ...command,
    });
    if (!revoked) throw new HttpException('Capability not found', 404);
    return { revoked: true };
  }
}

@Controller()
export class HealthController {
  @Get('health')
  public health() {
    return { status: 'ok' } as const;
  }

  @Get('ready')
  public ready() {
    return { status: 'ready' } as const;
  }
}
