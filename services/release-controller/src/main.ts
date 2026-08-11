import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { createReleaseControllerComposition } from './composition-root.js';

const composition = createReleaseControllerComposition();
const app = await NestFactory.create<NestFastifyApplication>(
  composition.module,
  new FastifyAdapter(),
);
await app.listen({ host: '0.0.0.0', port: Number(process.env['PORT'] ?? '3004') });
