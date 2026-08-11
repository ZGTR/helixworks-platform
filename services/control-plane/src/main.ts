import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ControlPlaneModule } from './composition-root.js';

const app = await NestFactory.create<NestFastifyApplication>(
  ControlPlaneModule,
  new FastifyAdapter(),
);
await app.listen(Number(process.env['PORT'] ?? 3001), '0.0.0.0');
