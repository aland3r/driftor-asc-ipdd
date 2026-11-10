import { Inject, Injectable, Logger } from '@nestjs/common';
import { Drift } from '../../domain/analysis';
import { ANALYSIS_REPOSITORY, AnalysisRepository, CLOCK, Clock } from '../ports';

export interface AnalysisCompletedMessage {
  analysisId: string;
  status: 'concluida' | 'falhou';
  error?: string;
  observationCount?: number;
  smoothingWindow?: number;
  outlierIndices?: number[];
  drifts?: Omit<Drift, 'position'>[];
}

/** Consumidor de analysis-completed. Idempotente: só altera análise ainda em andamento. */
@Injectable()
export class CompleteAnalysisHandler {
  private readonly log = new Logger('CompleteAnalysis');

  constructor(
    @Inject(ANALYSIS_REPOSITORY) private readonly analyses: AnalysisRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async handle(message: AnalysisCompletedMessage): Promise<boolean> {
    if (!message?.analysisId) return false;
    const now = this.clock.now();
    if (message.status !== 'concluida') {
      return this.analyses.fail(message.analysisId, message.error ?? 'Falha na análise.', now);
    }
    const drifts: Drift[] = (message.drifts ?? []).map((d, i) => ({ ...d, position: i + 1 }));
    const changed = await this.analyses.complete(message.analysisId, {
      observationCount: message.observationCount ?? 0,
      smoothingWindow: message.smoothingWindow ?? 1,
      outlierIndices: message.outlierIndices ?? [],
      drifts,
      completedAt: now,
    });
    if (!changed) this.log.warn(`análise ${message.analysisId} ignorada (inexistente ou já concluída)`);
    return changed;
  }
}
