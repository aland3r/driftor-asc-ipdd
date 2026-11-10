import { Inject, Injectable, Logger } from '@nestjs/common';
import { ANALYSIS_REPOSITORY, AnalysisRepository } from '../ports';

/** Consumidor de process-deleted: apaga as análises do processo excluído no pmining. */
@Injectable()
export class PurgeProcessAnalysesHandler {
  private readonly log = new Logger('PurgeProcessAnalyses');

  constructor(@Inject(ANALYSIS_REPOSITORY) private readonly analyses: AnalysisRepository) {}

  async handle(message: { processId?: string }): Promise<number> {
    if (!message?.processId) return 0;
    const removed = await this.analyses.deleteByProcess(message.processId);
    this.log.log(`processo ${message.processId} excluído: ${removed} análises apagadas`);
    return removed;
  }
}
