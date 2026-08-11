import { Body, Controller, Get, HttpException, Inject, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { connectorIdSchema, runIdSchema, type RequestContext } from '@helixworks/contracts';
import {
  ConnectorCommandRejected,
  ConnectorUnavailable,
  ExecuteSupplierOperation,
} from './application.js';

interface AuthenticatedRequest {
  readonly auth?: RequestContext;
}

const supplierSchema = z.object({
  externalId: z.string().min(1).max(100),
  legalName: z.string().min(1).max(200),
  contactEmail: z.string().email(),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
});
const commandSchema = z.object({
  commandId: z.string().uuid(),
  runId: runIdSchema,
  connectorId: connectorIdSchema,
  capabilityId: z.string().min(1).max(128),
  credentialReference: z.string().regex(/^(aws-sm|vault|secretref):\/\/[a-zA-Z0-9/_-]+$/),
  operation: z.discriminatedUnion('type', [
    z.object({ type: z.literal('supplier.create'), supplier: supplierSchema }),
    z.object({
      type: z.literal('supplier.status.set'),
      externalId: z.string().min(1).max(100),
      status: z.enum(['pending_review', 'active', 'suspended']),
    }),
  ]),
});

@Controller('v1/connectors/suppliers')
export class ConnectorController {
  public constructor(
    @Inject(ExecuteSupplierOperation) private readonly executeOperation: ExecuteSupplierOperation,
  ) {}

  @Post('commands')
  public async execute(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    if (request.auth === undefined) throw new HttpException('Unauthenticated', 401);
    const command = commandSchema.parse(body);
    try {
      return await this.executeOperation.execute(
        { ...command, tenantId: request.auth.tenantId },
        request.auth.correlationId,
      );
    } catch (error: unknown) {
      if (error instanceof ConnectorCommandRejected) {
        throw new HttpException({ message: error.message, decisionId: error.decisionId }, 403);
      }
      if (error instanceof ConnectorUnavailable) throw new HttpException(error.message, 502);
      throw error;
    }
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
