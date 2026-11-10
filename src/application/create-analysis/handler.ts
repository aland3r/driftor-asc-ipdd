import { Inject, Injectable } from '@nestjs/common';
import {
  Analysis,
  InvalidInputError,
  NotFoundError,
  defaultAnalysisName,
  normalizeName,
  validateRequest,
} from '../../domain/analysis';
import {
  ANALYSIS_REPOSITORY,
  AnalysisRepository,
  CLOCK,
  Clock,
  EVENT_PUBLISHER,
  EventPublisher,
  ID_GENERATOR,
  IdGenerator,
  PROCESS_GATEWAY,
  ProcessGateway,
} from '../ports';

export const ANALYSIS_REQUESTED_QUEUE = 'analysis-requested';

export interface CreateAnalysisCommand {
  processId: string;
  name?: string;
  delta?: number;
  treatment?: string;
  activity?: string | null;
}

/** Create da Análise: busca a série no pmining, grava "em andamento" e pede o ADWIN pela fila. */
@Injectable()
export class CreateAnalysisHandler {
  constructor(
    @Inject(ANALYSIS_REPOSITORY) private readonly analyses: AnalysisRepository,
    @Inject(PROCESS_GATEWAY) private readonly processes: ProcessGateway,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async handle(command: CreateAnalysisCommand): Promise<Analysis> {
    if (!command.processId) throw new InvalidInputError('Escolha o processo.');
    const delta = command.delta ?? 0.002;
    const treatment = validateRequest(delta, command.treatment ?? 'raw');
    const activity = normalizeName(command.activity) || null;

    const process = await this.processes.get(command.processId);
    if (!process) throw new NotFoundError('Processo não encontrado.');
    const points = await this.processes.series(process.id, activity);
    if (points.length < 2) throw new InvalidInputError('A série do processo precisa de ao menos duas observações.');

    const now = this.clock.now();
    const analysis: Analysis = {
      id: this.ids.newId(),
      processId: process.id,
      processName: process.name,
      name: normalizeName(command.name) || defaultAnalysisName(process.name, activity, now),
      delta,
      treatment,
      activity,
      status: 'em_andamento',
      error: null,
      observationCount: points.length,
      smoothingWindow: null,
      outlierIndices: [],
      driftCount: 0,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    await this.analyses.create(analysis, points);
    await this.publisher.publish(ANALYSIS_REQUESTED_QUEUE, {
      type: 'analysis-requested',
      analysisId: analysis.id,
      processId: process.id,
      values: points.map((p) => p.value),
      delta,
      treatment,
      requestedAt: now.toISOString(),
    });
    return analysis;
  }
}
