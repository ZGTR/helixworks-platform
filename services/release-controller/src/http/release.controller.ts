import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { releaseIdSchema, tenantIdSchema } from '@helixworks/contracts';
import { z } from 'zod';
import { PromoteRelease } from '../application/promote-release.js';
import { environments, type ArtifactDigest } from '../domain/release.js';

const promoteRequestSchema = z.object({
  releaseId: releaseIdSchema,
  environment: z.enum(environments),
  artifactDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  expectedPreviousArtifactDigest: z
    .string()
    .regex(/^sha256:[a-f0-9]{64}$/)
    .nullable(),
  correlationId: z.string().uuid(),
  causationId: z.string().uuid().nullable(),
});

@Controller('releases')
export class ReleaseController {
  public constructor(private readonly promoteRelease: PromoteRelease) {}

  @Post('promotions')
  @HttpCode(201)
  public async promote(
    @Headers('x-authenticated-tenant-id') authenticatedTenantId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const tenantId = tenantIdSchema.parse(authenticatedTenantId);
    const request = promoteRequestSchema.parse(body);
    return this.promoteRelease.execute({
      tenantId,
      ...request,
      artifactDigest: request.artifactDigest as ArtifactDigest,
      expectedPreviousArtifactDigest:
        request.expectedPreviousArtifactDigest as ArtifactDigest | null,
    });
  }
}
