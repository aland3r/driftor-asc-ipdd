import { Inject, Injectable } from '@nestjs/common';
import { AnalysisDetail, NotFoundError, Segment, segmentsOf } from '../../domain/analysis';
import { ANALYSIS_REPOSITORY, AnalysisRepository } from '../ports';

export interface AnalysisView extends AnalysisDetail {
  segments: Segment[];
}

@Injectable()
export class GetAnalysisHandler {
  constructor(@Inject(ANALYSIS_REPOSITORY) private readonly analyses: AnalysisRepository) {}

  async handle(id: string): Promise<AnalysisView> {
    const analysis = await this.analyses.get(id);
    if (!analysis) throw new NotFoundError('Análise não encontrada.');
    return { ...analysis, segments: segmentsOf(analysis.points, analysis.drifts, analysis.outlierIndices) };
  }
}
