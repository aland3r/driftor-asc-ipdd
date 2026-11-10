import { Inject, Injectable } from '@nestjs/common';
import { Analysis } from '../../domain/analysis';
import { ANALYSIS_REPOSITORY, AnalysisRepository } from '../ports';

@Injectable()
export class ListAnalysesHandler {
  constructor(@Inject(ANALYSIS_REPOSITORY) private readonly analyses: AnalysisRepository) {}

  async handle(processId?: string): Promise<Analysis[]> {
    const items = await this.analyses.list(processId);
    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
