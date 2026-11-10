import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/api/app.module';
import { configure } from '../../src/api/main';
import { CompleteAnalysisHandler } from '../../src/application/complete-analysis/handler';
import { MemoryAnalysisRepository } from '../../src/infrastructure/memory/memory-analysis.repository';
import { LogOnlyPublisher } from '../../src/infrastructure/messaging/service-bus';
import { DRIFT, FakeProcesses } from '../unit/support';

describe('API HTTP', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        AppModule.register({ repository: new MemoryAnalysisRepository(), gateway: new FakeProcesses(), publisher: new LogOnlyPublisher() }),
      ],
    }).compile();
    app = configure(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(() => app.close());

  it('faz o CRUD completo', async () => {
    const http = request(app.getHttpServer());
    const created = await http.post('/analyses').send({ processId: 'p1', treatment: 'raw' }).expect(201);
    const id = created.body.id;
    await app.get(CompleteAnalysisHandler).handle({ analysisId: id, status: 'concluida', drifts: [DRIFT], observationCount: 10 });

    const list = await http.get('/analyses').query({ processId: 'p1' }).expect(200);
    expect(list.body).toHaveLength(1);
    const detail = await http.get(`/analyses/${id}`).expect(200);
    expect(detail.body.segments).toHaveLength(2);
    expect(detail.body.points).toHaveLength(10);

    const renamed = await http.patch(`/analyses/${id}`).send({ name: 'Nova' }).expect(200);
    expect(renamed.body.name).toBe('Nova');
    await http.delete(`/analyses/${id}`).expect(204);
    await http.get(`/analyses/${id}`).expect(404);
  });

  it('responde 422 para entrada inválida e publica o swagger e o asyncapi', async () => {
    const http = request(app.getHttpServer());
    await http.post('/analyses').send({ processId: 'p1', delta: 5 }).expect(422);
    const docs = await http.get('/docs-json').expect(200);
    expect(docs.body.info.title).toContain('ipdd');
    const events = await http.get('/asyncapi.yaml').expect(200);
    expect(events.text).toContain('analysis-requested');
  });
});
