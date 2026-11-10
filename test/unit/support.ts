import { CompleteAnalysisHandler } from '../../src/application/complete-analysis/handler';
import { CreateAnalysisHandler } from '../../src/application/create-analysis/handler';
import { DeleteAnalysisHandler } from '../../src/application/delete-analysis/handler';
import { GetAnalysisHandler } from '../../src/application/get-analysis/handler';
import { ListAnalysesHandler } from '../../src/application/list-analyses/handler';
import { PurgeProcessAnalysesHandler } from '../../src/application/purge-process-analyses/handler';
import { RenameAnalysisHandler } from '../../src/application/rename-analysis/handler';
import { ProcessGateway } from '../../src/application/ports';
import { SeriesPoint } from '../../src/domain/analysis';
import { MemoryAnalysisRepository } from '../../src/infrastructure/memory/memory-analysis.repository';
import { LogOnlyPublisher } from '../../src/infrastructure/messaging/service-bus';

export const SERIES: SeriesPoint[] = Array.from({ length: 10 }, (_, i) => ({
  index: i + 1,
  caseId: String(i + 1),
  value: i < 5 ? 10 : 20,
}));

export class FakeProcesses implements ProcessGateway {
  async get(id: string) {
    return id === 'p1' ? { id: 'p1', name: 'DR_20' } : null;
  }
  async series() {
    return SERIES;
  }
}

export function setup() {
  const repo = new MemoryAnalysisRepository();
  const publisher = new LogOnlyPublisher();
  const clock = { now: () => new Date('2026-11-10T12:00:00Z') };
  let n = 0;
  const ids = { newId: () => `a${++n}` };
  const processes = new FakeProcesses();
  return {
    repo,
    publisher,
    processes,
    clock,
    ids,
    create: new CreateAnalysisHandler(repo, processes, publisher, clock, ids),
    complete: new CompleteAnalysisHandler(repo, clock),
    list: new ListAnalysesHandler(repo),
    get: new GetAnalysisHandler(repo),
    rename: new RenameAnalysisHandler(repo, clock),
    remove: new DeleteAnalysisHandler(repo),
    purge: new PurgeProcessAnalysesHandler(repo),
  };
}

export const DRIFT = {
  index: 7,
  anomalyStartIndex: 5,
  value: 20,
  width: 8,
  estimation: 15,
  meanBefore: 10,
  meanAfter: 20,
  changePercent: 100,
};
