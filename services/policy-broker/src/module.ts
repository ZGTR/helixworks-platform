import { Module } from '@nestjs/common';
import { CryptoIdGenerator, SystemClock } from '@helixworks/service-kit';
import { DecideCapability, IssueCapability, RevokeCapability } from './application.js';
import { HealthController, PolicyController } from './controller.js';
import { InMemoryPolicyStore } from './infrastructure.js';
import { AUDIT_SINK, CAPABILITY_REPOSITORY, CLOCK, ID_GENERATOR } from './ports.js';

const store = new InMemoryPolicyStore();

@Module({
  controllers: [PolicyController, HealthController],
  providers: [
    { provide: CAPABILITY_REPOSITORY, useValue: store },
    { provide: AUDIT_SINK, useValue: store },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: CryptoIdGenerator },
    {
      provide: IssueCapability,
      useFactory: (repository: InMemoryPolicyStore, clock: SystemClock, ids: CryptoIdGenerator) =>
        new IssueCapability(repository, clock, ids),
      inject: [CAPABILITY_REPOSITORY, CLOCK, ID_GENERATOR],
    },
    {
      provide: DecideCapability,
      useFactory: (
        repository: InMemoryPolicyStore,
        audit: InMemoryPolicyStore,
        clock: SystemClock,
        ids: CryptoIdGenerator,
      ) => new DecideCapability(repository, audit, clock, ids),
      inject: [CAPABILITY_REPOSITORY, AUDIT_SINK, CLOCK, ID_GENERATOR],
    },
    {
      provide: RevokeCapability,
      useFactory: (repository: InMemoryPolicyStore, clock: SystemClock, ids: CryptoIdGenerator) =>
        new RevokeCapability(repository, clock, ids),
      inject: [CAPABILITY_REPOSITORY, CLOCK, ID_GENERATOR],
    },
  ],
})
export class PolicyBrokerModule {}
