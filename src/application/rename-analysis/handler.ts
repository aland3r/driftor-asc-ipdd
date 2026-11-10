import { Inject, Injectable } from '@nestjs/common';
import { InvalidInputError, NotFoundError, normalizeName } from '../../domain/analysis';
import { ANALYSIS_REPOSITORY, AnalysisRepository, CLOCK, Clock } from '../ports';

/** Update da Análise: renomear. */
@Injectable()
export class RenameAnalysisHandler {
  constructor(
    @Inject(ANALYSIS_REPOSITORY) private readonly analyses: AnalysisRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async handle(id: string, name: string): Promise<void> {
    const clean = normalizeName(name);
    if (!clean) throw new InvalidInputError('Informe o nome da análise.');
    if (!(await this.analyses.rename(id, clean, this.clock.now()))) throw new NotFoundError('Análise não encontrada.');
  }
}
