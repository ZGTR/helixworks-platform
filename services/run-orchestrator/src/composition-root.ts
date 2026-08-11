import { Module } from '@nestjs/common';
import { CryptoIdGenerator, InMemoryOutboxRepository, SystemClock } from '@helixworks/service-kit';
import { RunUseCases } from './application/run-use-cases.js';
import { HealthController, RunController } from './http/controllers.js';
import { ApprovedBlueprintProjection, InMemoryRunStore } from './infrastructure/in-memory-runs.js';

const outbox = new InMemoryOutboxRepository();
const store = new InMemoryRunStore(outbox);
const approvedBlueprints = new ApprovedBlueprintProjection();

@Module({
  controllers: [RunController, HealthController],
  providers: [
    {
      provide: RunUseCases,
      useFactory: () =>
        new RunUseCases(
          approvedBlueprints,
          store,
          store,
          new SystemClock(),
          new CryptoIdGenerator(),
        ),
    },
  ],
})
export class RunOrchestratorModule {}
