import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { PolicyBrokerModule } from './module.js';

const app = await NestFactory.create<NestFastifyApplication>(
  PolicyBrokerModule,
  new FastifyAdapter({ logger: true }),
);
await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? '4102') });
