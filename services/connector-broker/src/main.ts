import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConnectorBrokerModule } from './module.js';

const app = await NestFactory.create<NestFastifyApplication>(
  ConnectorBrokerModule,
  new FastifyAdapter({ logger: true }),
);
await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? '4103') });
