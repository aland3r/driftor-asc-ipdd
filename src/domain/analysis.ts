/** Entidades e regras puras da análise de desvios. Sem dependências externas. */

export type Treatment = 'raw' | 'treated';
export type AnalysisStatus = 'em_andamento' | 'concluida' | 'falhou';

export const TREATMENTS: Treatment[] = ['raw', 'treated'];

export class DomainError extends Error {}
export class NotFoundError extends DomainError {}
export class InvalidInputError extends DomainError {}

export interface SeriesPoint {
  index: number;
  caseId: string;
  value: number;
}

export interface Drift {
  position: number;
  index: number;
  anomalyStartIndex: number;
  value: number;
  width: number;
  estimation: number;
  meanBefore: number;
  meanAfter: number;
  changePercent: number;
}

export interface Analysis {
  id: string;
  processId: string;
  processName: string;
  name: string;
  delta: number;
  treatment: Treatment;
  activity: string | null;
  status: AnalysisStatus;
  error: string | null;
  observationCount: number;
  smoothingWindow: number | null;
  outlierIndices: number[];
  driftCount: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface AnalysisDetail extends Analysis {
  drifts: Drift[];
  points: SeriesPoint[];
}

export interface Segment {
  id: string;
  label: string;
  startIndex: number;
  endIndex: number;
  traceCount: number;
  mean: number;
  outlierCount: number;
  driftCount: number;
}

export function normalizeName(name: string | undefined | null): string {
  return (name ?? '').trim().split(/\s+/).filter(Boolean).join(' ');
}

export function validateRequest(delta: number, treatment: string): Treatment {
  if (!(delta > 0 && delta < 1)) throw new InvalidInputError('δ precisa estar entre 0 e 1.');
  if (!TREATMENTS.includes(treatment as Treatment)) {
    throw new InvalidInputError(`Tratamento desconhecido: ${treatment}. Use 'raw' ou 'treated'.`);
  }
  return treatment as Treatment;
}

export function defaultAnalysisName(processName: string, activity: string | null, at: Date): string {
  const day = at.toISOString().slice(0, 10).split('-').reverse().join('/');
  return `${processName}${activity ? ` · ${activity}` : ''} · ${day}`;
}

/**
 * Segmentos entre desvios: o primeiro vai do início até o começo da primeira
 * anomalia, e assim por diante. A lista de traces da análise agrupa por eles.
 */
export function segmentsOf(points: SeriesPoint[], drifts: Drift[], outlierIndices: number[]): Segment[] {
  if (points.length === 0) return [];
  const starts = [...new Set(drifts.map((d) => d.anomalyStartIndex))]
    .filter((s) => s > 0 && s < points.length)
    .sort((a, b) => a - b);
  const bounds = [0, ...starts, points.length];
  const outliers = new Set(outlierIndices);
  const segments: Segment[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const from = bounds[i];
    const to = bounds[i + 1];
    const slice = points.slice(from, to);
    const mean = slice.reduce((sum, p) => sum + p.value, 0) / (slice.length || 1);
    segments.push({
      id: `s${i + 1}`,
      label: `Segmento ${i + 1}`,
      startIndex: from,
      endIndex: to - 1,
      traceCount: slice.length,
      mean: Math.round(mean * 1000) / 1000,
      outlierCount: slice.filter((_, k) => outliers.has(from + k)).length,
      driftCount: i > 0 ? 1 : 0,
    });
  }
  return segments;
}
