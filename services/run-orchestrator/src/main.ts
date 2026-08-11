import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { RunOrchestratorModule } from './composition-root.js';

const app = await NestFactory.create<NestFastifyApplication>(
  RunOrchestratorModule,
  new FastifyAdapter(),
);
await app.listen(Number(process.env['PORT'] ?? 3002), '0.0.0.0');
