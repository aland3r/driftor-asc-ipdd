import { Analysis, AnalysisDetail, Drift, SeriesPoint } from '../domain/analysis';

export const ANALYSIS_REPOSITORY = Symbol('AnalysisRepository');
export const PROCESS_GATEWAY = Symbol('ProcessGateway');
export const EVENT_PUBLISHER = Symbol('EventPublisher');
export const CLOCK = Symbol('Clock');
export const ID_GENERATOR = Symbol('IdGenerator');

export interface CompletionData {
  observationCount: number;
  smoothingWindow: number;
  outlierIndices: number[];
  drifts: Drift[];
  completedAt: Date;
}

export interface AnalysisRepository {
  create(analysis: Analysis, points: SeriesPoint[]): Promise<void>;
  list(processId?: string): Promise<Analysis[]>;
  get(id: string): Promise<AnalysisDetail | null>;
  rename(id: string, name: string, at: Date): Promise<boolean>;
  complete(id: string, data: CompletionData): Promise<boolean>;
  fail(id: string, error: string, at: Date): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  deleteByProcess(processId: string): Promise<number>;
}

export interface ProcessInfo {
  id: string;
  name: string;
}

export interface ProcessGateway {
  get(processId: string): Promise<ProcessInfo | null>;
  series(processId: string, activity: string | null): Promise<SeriesPoint[]>;
}

export interface EventPublisher {
  publish(queue: string, body: Record<string, unknown>): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  newId(): string;
}
