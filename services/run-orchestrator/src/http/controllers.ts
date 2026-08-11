import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import {
  artifactIdSchema,
  requestContextSchema,
  runIdSchema,
  startRunCommandSchema,
  type RequestContext,
} from '@helixworks/contracts';
import { z } from 'zod';
import { RunUseCases } from '../application/run-use-cases.js';

interface AuthenticatedRequest {
  readonly user: RequestContext;
}
const stepSchema = z.object({ costUsd: z.number().nonnegative().max(100) });
const artifactSchema = z.object({
  artifactId: artifactIdSchema,
  artifact: z.string().min(1).max(1_000_000),
});

@Controller()
export class HealthController {
  @Get('/health') public health() {
    return { status: 'ok' };
  }
  @Get('/ready') public ready() {
    return { status: 'ready' };
  }
}

@Controller('/v1/runs')
export class RunController {
  public constructor(private readonly runs: RunUseCases) {}
  @Post() public start(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.runs.start(requestContextSchema.parse(req.user), startRunCommandSchema.parse(body));
  }
  @Post('/:runId/steps') public consume(
    @Req() req: AuthenticatedRequest,
    @Param('runId') id: unknown,
    @Body() body: unknown,
  ) {
    return this.runs.consume(
      requestContextSchema.parse(req.user),
      runIdSchema.parse(id),
      stepSchema.parse(body).costUsd,
    );
  }
  @Post('/:runId/complete') public complete(
    @Req() req: AuthenticatedRequest,
    @Param('runId') id: unknown,
    @Body() body: unknown,
  ) {
    const command = artifactSchema.parse(body);
    return this.runs.complete(
      requestContextSchema.parse(req.user),
      runIdSchema.parse(id),
      command.artifactId,
      command.artifact,
    );
  }
  @Post('/:runId/cancel') public cancel(
    @Req() req: AuthenticatedRequest,
    @Param('runId') id: unknown,
  ) {
    return this.runs.cancel(requestContextSchema.parse(req.user), runIdSchema.parse(id));
  }
  @Post('/:runId/compensate') public compensate(
    @Req() req: AuthenticatedRequest,
    @Param('runId') id: unknown,
  ) {
    return this.runs.compensate(requestContextSchema.parse(req.user), runIdSchema.parse(id));
  }
}
