import { Module } from '@nestjs/common';
import { ExecuteSupplierOperation } from './application.js';
import { ConnectorController, HealthController } from './controller.js';
import {
  HttpPolicyDecisionClient,
  HttpSupplierGateway,
  InMemoryConnectorExecutionRepository,
} from './infrastructure.js';
import { EXECUTION_REPOSITORY, POLICY_DECISION_PORT, SUPPLIER_GATEWAY } from './ports.js';

const required = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.length === 0)
    throw new Error(`Missing required configuration: ${name}`);
  return value;
};

@Module({
  controllers: [ConnectorController, HealthController],
  providers: [
    {
      provide: POLICY_DECISION_PORT,
      useFactory: () =>
        new HttpPolicyDecisionClient(required('POLICY_BROKER_URL'), required('SERVICE_TOKEN')),
    },
    {
      provide: SUPPLIER_GATEWAY,
      useFactory: () => new HttpSupplierGateway(required('SUPPLIER_API_URL')),
    },
    { provide: EXECUTION_REPOSITORY, useClass: InMemoryConnectorExecutionRepository },
    {
      provide: ExecuteSupplierOperation,
      useFactory: (
        policy: HttpPolicyDecisionClient,
        gateway: HttpSupplierGateway,
        executions: InMemoryConnectorExecutionRepository,
      ) =>
        new ExecuteSupplierOperation(
          policy,
          gateway,
          executions,
          Number(process.env.CONNECTOR_TIMEOUT_MS ?? '5000'),
        ),
      inject: [POLICY_DECISION_PORT, SUPPLIER_GATEWAY, EXECUTION_REPOSITORY],
    },
  ],
})
export class ConnectorBrokerModule {}
