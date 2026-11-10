import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../domain/analysis';
import { ANALYSIS_REPOSITORY, AnalysisRepository } from '../ports';

@Injectable()
export class DeleteAnalysisHandler {
  constructor(@Inject(ANALYSIS_REPOSITORY) private readonly analyses: AnalysisRepository) {}

  async handle(id: string): Promise<void> {
    if (!(await this.analyses.delete(id))) throw new NotFoundError('Análise não encontrada.');
  }
}
