import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import {
  approveBlueprintCommandSchema,
  requestContextSchema,
  type RequestContext,
} from '@helixworks/contracts';
import { ApproveBlueprintUseCase } from '../application/approve-blueprint.js';

interface AuthenticatedRequest {
  readonly user: RequestContext;
}

@Controller()
export class HealthController {
  @Get('/health') public health() {
    return { status: 'ok' };
  }
  @Get('/ready') public ready() {
    return { status: 'ready' };
  }
}

@Controller('/v1/blueprints')
export class BlueprintController {
  public constructor(private readonly approve: ApproveBlueprintUseCase) {}

  @Post('/approve')
  public approveBlueprint(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.approve.execute(
      requestContextSchema.parse(request.user),
      approveBlueprintCommandSchema.parse(body),
    );
  }
}
