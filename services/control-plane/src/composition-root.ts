import { Module } from '@nestjs/common';
import { InMemoryOutboxRepository, SystemClock, CryptoIdGenerator } from '@helixworks/service-kit';
import { ApproveBlueprintUseCase } from './application/approve-blueprint.js';
import { BlueprintController, HealthController } from './http/controllers.js';
import { InMemoryBlueprintStore } from './infrastructure/in-memory-blueprints.js';

const outbox = new InMemoryOutboxRepository();
const store = new InMemoryBlueprintStore(outbox);

@Module({
  controllers: [BlueprintController, HealthController],
  providers: [
    {
      provide: ApproveBlueprintUseCase,
      useFactory: () =>
        new ApproveBlueprintUseCase(store, store, new SystemClock(), new CryptoIdGenerator()),
    },
  ],
})
export class ControlPlaneModule {}
