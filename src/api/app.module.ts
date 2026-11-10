import { DynamicModule, Logger, Module, OnApplicationShutdown, OnModuleInit, Inject, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { ServiceBusClient } from '@azure/service-bus';
import { CompleteAnalysisHandler } from '../application/complete-analysis/handler';
import { CreateAnalysisHandler } from '../application/create-analysis/handler';
import { DeleteAnalysisHandler } from '../application/delete-analysis/handler';
import { GetAnalysisHandler } from '../application/get-analysis/handler';
import { ListAnalysesHandler } from '../application/list-analyses/handler';
import { PurgeProcessAnalysesHandler } from '../application/purge-process-analyses/handler';
import { RenameAnalysisHandler } from '../application/rename-analysis/handler';
import {
  ANALYSIS_REPOSITORY,
  AnalysisRepository,
  CLOCK,
  EVENT_PUBLISHER,
  EventPublisher,
  ID_GENERATOR,
  PROCESS_GATEWAY,
  ProcessGateway,
} from '../application/ports';
import { PminingHttpGateway } from '../infrastructure/http/pmining.gateway';
import { MemoryAnalysisRepository } from '../infrastructure/memory/memory-analysis.repository';
import { LogOnlyPublisher, ServiceBusPublisher, subscribe } from '../infrastructure/messaging/service-bus';
import type { SqlAnalysisRepository } from '../infrastructure/sql/sql-analysis.repository';
import { AnalysesController } from './analyses.controller';
import { HealthController } from './health.controller';

export const SERVICE_BUS = Symbol('ServiceBusClient');

export interface IpddModuleOptions {
  repository: AnalysisRepository;
  gateway: ProcessGateway;
  publisher: EventPublisher;
  bus?: ServiceBusClient | null;
  clock?: { now(): Date };
  ids?: { newId(): string };
}

/** Assina as filas analysis-completed e process-deleted quando há Service Bus. */
class QueueConsumers implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger('Filas');
  private receivers: { close(): Promise<void> }[] = [];

  constructor(
    @Optional() @Inject(SERVICE_BUS) private readonly bus: ServiceBusClient | null,
    private readonly complete: CompleteAnalysisHandler,
    private readonly purge: PurgeProcessAnalysesHandler,
  ) {}

  onModuleInit() {
    if (!this.bus) {
      this.log.warn('SERVICEBUS_CONNECTION ausente; filas não assinadas');
      return;
    }
    this.receivers = [
      subscribe(this.bus, 'analysis-completed', (body) => this.complete.handle(body)),
      subscribe(this.bus, 'process-deleted', (body) => this.purge.handle(body)),
    ];
  }

  async onApplicationShutdown() {
    await Promise.all(this.receivers.map((r) => r.close()));
    await this.bus?.close();
  }
}

@Module({})
export class AppModule {
  static register(options: IpddModuleOptions): DynamicModule {
    return {
      module: AppModule,
      controllers: [AnalysesController, HealthController],
      providers: [
        { provide: ANALYSIS_REPOSITORY, useValue: options.repository },
        { provide: PROCESS_GATEWAY, useValue: options.gateway },
        { provide: EVENT_PUBLISHER, useValue: options.publisher },
        { provide: SERVICE_BUS, useValue: options.bus ?? null },
        { provide: CLOCK, useValue: options.clock ?? { now: () => new Date() } },
        { provide: ID_GENERATOR, useValue: options.ids ?? { newId: () => randomUUID() } },
        CreateAnalysisHandler,
        CompleteAnalysisHandler,
        ListAnalysesHandler,
        GetAnalysisHandler,
        RenameAnalysisHandler,
        DeleteAnalysisHandler,
        PurgeProcessAnalysesHandler,
        QueueConsumers,
      ],
    };
  }

  /** Composição de produção a partir das variáveis de ambiente. */
  static async fromEnv(): Promise<DynamicModule> {
    const log = new Logger('Bootstrap');
    const connection = process.env.AZURE_SQL_CONNECTION;
    // Import tardio: o driver do SQL só é carregado quando há conexão configurada.
    const repository = connection
      ? await (require('../infrastructure/sql/sql-analysis.repository').SqlAnalysisRepository as typeof SqlAnalysisRepository).connect(connection)
      : new MemoryAnalysisRepository();
    if (!connection) log.warn('AZURE_SQL_CONNECTION ausente; usando repositório em memória');
    // Import tardio: o SDK do Service Bus só é carregado quando há conexão configurada.
    const bus: ServiceBusClient | null = process.env.SERVICEBUS_CONNECTION
      ? new (require('@azure/service-bus').ServiceBusClient)(process.env.SERVICEBUS_CONNECTION)
      : null;
    return AppModule.register({
      repository,
      gateway: new PminingHttpGateway(process.env.PMINING_URL ?? 'http://localhost:8080'),
      publisher: bus ? new ServiceBusPublisher(bus) : new LogOnlyPublisher(),
      bus,
    });
  }
}
