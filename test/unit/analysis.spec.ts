import { InvalidInputError, NotFoundError, segmentsOf } from '../../src/domain/analysis';
import { DRIFT, SERIES, setup } from './support';

describe('domínio', () => {
  it('quebra a série em segmentos pelos desvios', () => {
    const segments = segmentsOf(SERIES, [{ ...DRIFT, position: 1 }], [2]);
    expect(segments.map((s) => [s.label, s.traceCount, s.mean, s.outlierCount, s.driftCount])).toEqual([
      ['Segmento 1', 5, 10, 1, 0],
      ['Segmento 2', 5, 20, 0, 1],
    ]);
  });
});

describe('CRUD de análises', () => {
  it('cria em andamento e publica analysis-requested com a série', async () => {
    const s = setup();
    const a = await s.create.handle({ processId: 'p1', treatment: 'raw', activity: 'Machine_Operating' });
    expect(a.status).toBe('em_andamento');
    expect(a.name).toBe('DR_20 · Machine_Operating · 10/11/2026');
    expect(s.publisher.sent[0].queue).toBe('analysis-requested');
    expect(s.publisher.sent[0].body).toMatchObject({ analysisId: 'a1', delta: 0.002, treatment: 'raw' });
    expect((s.publisher.sent[0].body.values as number[]).length).toBe(10);
  });

  it('valida δ, tratamento e processo', async () => {
    const s = setup();
    await expect(s.create.handle({ processId: 'p1', delta: 2 })).rejects.toBeInstanceOf(InvalidInputError);
    await expect(s.create.handle({ processId: 'p1', treatment: 'x' })).rejects.toBeInstanceOf(InvalidInputError);
    await expect(s.create.handle({ processId: 'nope' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(s.create.handle({ processId: '' })).rejects.toBeInstanceOf(InvalidInputError);
  });

  it('conclui uma vez só (idempotente) e mostra segmentos', async () => {
    const s = setup();
    const a = await s.create.handle({ processId: 'p1' });
    const msg = { analysisId: a.id, status: 'concluida' as const, observationCount: 10, smoothingWindow: 1, outlierIndices: [], drifts: [DRIFT] };
    expect(await s.complete.handle(msg)).toBe(true);
    expect(await s.complete.handle(msg)).toBe(false);
    const view = await s.get.handle(a.id);
    expect(view.status).toBe('concluida');
    expect(view.driftCount).toBe(1);
    expect(view.drifts[0].position).toBe(1);
    expect(view.segments).toHaveLength(2);
  });

  it('registra falha vinda da Function', async () => {
    const s = setup();
    const a = await s.create.handle({ processId: 'p1' });
    await s.complete.handle({ analysisId: a.id, status: 'falhou', error: 'série curta' });
    expect((await s.get.handle(a.id)).error).toBe('série curta');
  });

  it('renomeia, lista, exclui e apaga em cascata por processo', async () => {
    const s = setup();
    const a = await s.create.handle({ processId: 'p1' });
    await s.create.handle({ processId: 'p1' });
    await s.rename.handle(a.id, '  Torno 02  ');
    expect((await s.get.handle(a.id)).name).toBe('Torno 02');
    await expect(s.rename.handle(a.id, ' ')).rejects.toBeInstanceOf(InvalidInputError);
    await s.remove.handle(a.id);
    await expect(s.remove.handle(a.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await s.list.handle('p1')).toHaveLength(1);
    expect(await s.purge.handle({ processId: 'p1' })).toBe(1);
    expect(await s.list.handle()).toHaveLength(0);
  });
});
