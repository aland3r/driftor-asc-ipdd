import { Analysis, AnalysisDetail, Drift, SeriesPoint } from '../../domain/analysis';
import { AnalysisRepository, CompletionData } from '../../application/ports';

/** Repositório em memória: testes e execução local sem Azure SQL. */
export class MemoryAnalysisRepository implements AnalysisRepository {
  private readonly items = new Map<string, { analysis: Analysis; points: SeriesPoint[]; drifts: Drift[] }>();

  async create(analysis: Analysis, points: SeriesPoint[]) {
    this.items.set(analysis.id, { analysis: { ...analysis }, points: [...points], drifts: [] });
  }

  async list(processId?: string) {
    return [...this.items.values()]
      .map((i) => ({ ...i.analysis }))
      .filter((a) => !processId || a.processId === processId);
  }

  async get(id: string): Promise<AnalysisDetail | null> {
    const item = this.items.get(id);
    return item ? { ...item.analysis, points: [...item.points], drifts: [...item.drifts] } : null;
  }

  async rename(id: string, name: string, at: Date) {
    const item = this.items.get(id);
    if (!item) return false;
    item.analysis = { ...item.analysis, name, updatedAt: at };
    return true;
  }

  async complete(id: string, data: CompletionData) {
    const item = this.items.get(id);
    if (!item || item.analysis.status !== 'em_andamento') return false;
    item.analysis = {
      ...item.analysis,
      status: 'concluida',
      observationCount: data.observationCount,
      smoothingWindow: data.smoothingWindow,
      outlierIndices: data.outlierIndices,
      driftCount: data.drifts.length,
      completedAt: data.completedAt,
      updatedAt: data.completedAt,
    };
    item.drifts = [...data.drifts];
    return true;
  }

  async fail(id: string, error: string, at: Date) {
    const item = this.items.get(id);
    if (!item || item.analysis.status !== 'em_andamento') return false;
    item.analysis = { ...item.analysis, status: 'falhou', error, updatedAt: at };
    return true;
  }

  async delete(id: string) {
    return this.items.delete(id);
  }

  async deleteByProcess(processId: string) {
    let removed = 0;
    for (const [id, item] of this.items) {
      if (item.analysis.processId === processId) {
        this.items.delete(id);
        removed++;
      }
    }
    return removed;
  }
}
