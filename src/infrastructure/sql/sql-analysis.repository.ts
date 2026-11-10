import * as sql from 'mssql';
import { Analysis, AnalysisDetail, Drift, SeriesPoint } from '../../domain/analysis';
import { AnalysisRepository, CompletionData } from '../../application/ports';
import { MIGRATIONS } from './migrations';

/** Repositório de análises no Azure SQL (driver mssql). */
export class SqlAnalysisRepository implements AnalysisRepository {
  private constructor(private readonly pool: sql.ConnectionPool) {}

  /** O banco serverless pausa sozinho; a primeira conexão pode levar perto de um minuto. */
  static async connect(connectionString: string): Promise<SqlAnalysisRepository> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const pool = await new sql.ConnectionPool(withTimeouts(connectionString)).connect();
        for (const statement of MIGRATIONS) await pool.request().batch(statement);
        return new SqlAnalysisRepository(pool);
      } catch (err) {
        lastError = err;
        await new Promise((r) => setTimeout(r, attempt * 5000));
      }
    }
    throw lastError;
  }

  async create(a: Analysis, points: SeriesPoint[]): Promise<void> {
    const tx = new sql.Transaction(this.pool);
    await tx.begin();
    try {
      await new sql.Request(tx)
        .input('id', sql.NVarChar(36), a.id)
        .input('process_id', sql.NVarChar(64), a.processId)
        .input('process_name', sql.NVarChar(200), a.processName)
        .input('name', sql.NVarChar(200), a.name)
        .input('delta', sql.Float, a.delta)
        .input('treatment', sql.NVarChar(16), a.treatment)
        .input('activity', sql.NVarChar(160), a.activity)
        .input('status', sql.NVarChar(16), a.status)
        .input('observation_count', sql.Int, a.observationCount)
        .input('created_at', sql.DateTimeOffset, a.createdAt)
        .input('updated_at', sql.DateTimeOffset, a.updatedAt)
        .query(`INSERT INTO dbo.analyses
          (id, process_id, process_name, name, delta, treatment, activity, status, observation_count, created_at, updated_at)
          VALUES (@id, @process_id, @process_name, @name, @delta, @treatment, @activity, @status, @observation_count, @created_at, @updated_at)`);

      const table = new sql.Table('dbo.analysis_points');
      table.create = false;
      table.columns.add('analysis_id', sql.NVarChar(36), { nullable: false });
      table.columns.add('idx', sql.Int, { nullable: false });
      table.columns.add('case_id', sql.NVarChar(128), { nullable: false });
      table.columns.add('value', sql.Float, { nullable: false });
      points.forEach((p) => table.rows.add(a.id, p.index, p.caseId, p.value));
      await new sql.Request(tx).bulk(table);
      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  async list(processId?: string): Promise<Analysis[]> {
    const req = this.pool.request();
    let where = '';
    if (processId) {
      req.input('process_id', sql.NVarChar(64), processId);
      where = 'WHERE process_id = @process_id';
    }
    const result = await req.query(`SELECT * FROM dbo.analyses ${where} ORDER BY created_at DESC`);
    return result.recordset.map(toAnalysis);
  }

  async get(id: string): Promise<AnalysisDetail | null> {
    const result = await this.pool
      .request()
      .input('id', sql.NVarChar(36), id)
      .query(`SELECT * FROM dbo.analyses WHERE id = @id;
              SELECT * FROM dbo.drifts WHERE analysis_id = @id ORDER BY position;
              SELECT idx, case_id, value FROM dbo.analysis_points WHERE analysis_id = @id ORDER BY idx;`);
    const sets = result.recordsets as sql.IRecordSet<any>[];
    if (sets[0].length === 0) return null;
    return {
      ...toAnalysis(sets[0][0]),
      drifts: sets[1].map(toDrift),
      points: sets[2].map((r) => ({ index: r.idx, caseId: r.case_id, value: r.value })),
    };
  }

  async rename(id: string, name: string, at: Date): Promise<boolean> {
    const r = await this.pool
      .request()
      .input('id', sql.NVarChar(36), id)
      .input('name', sql.NVarChar(200), name)
      .input('at', sql.DateTimeOffset, at)
      .query('UPDATE dbo.analyses SET name = @name, updated_at = @at WHERE id = @id');
    return r.rowsAffected[0] > 0;
  }

  async complete(id: string, data: CompletionData): Promise<boolean> {
    const tx = new sql.Transaction(this.pool);
    await tx.begin();
    try {
      const r = await new sql.Request(tx)
        .input('id', sql.NVarChar(36), id)
        .input('observation_count', sql.Int, data.observationCount)
        .input('smoothing_window', sql.Int, data.smoothingWindow)
        .input('outliers', sql.NVarChar(sql.MAX), JSON.stringify(data.outlierIndices))
        .input('drift_count', sql.Int, data.drifts.length)
        .input('at', sql.DateTimeOffset, data.completedAt)
        .query(`UPDATE dbo.analyses SET status = 'concluida', error = NULL, observation_count = @observation_count,
                  smoothing_window = @smoothing_window, outlier_indices = @outliers, drift_count = @drift_count,
                  completed_at = @at, updated_at = @at
                WHERE id = @id AND status = 'em_andamento'`);
      if (r.rowsAffected[0] === 0) {
        await tx.rollback();
        return false;
      }
      for (const d of data.drifts) {
        await new sql.Request(tx)
          .input('analysis_id', sql.NVarChar(36), id)
          .input('position', sql.Int, d.position)
          .input('detection_index', sql.Int, d.index)
          .input('anomaly_start_index', sql.Int, d.anomalyStartIndex)
          .input('value', sql.Float, d.value)
          .input('width', sql.Float, d.width)
          .input('estimation', sql.Float, d.estimation)
          .input('mean_before', sql.Float, d.meanBefore)
          .input('mean_after', sql.Float, d.meanAfter)
          .input('change_percent', sql.Float, d.changePercent)
          .query(`INSERT INTO dbo.drifts (analysis_id, position, detection_index, anomaly_start_index, value, width,
                    estimation, mean_before, mean_after, change_percent)
                  VALUES (@analysis_id, @position, @detection_index, @anomaly_start_index, @value, @width,
                    @estimation, @mean_before, @mean_after, @change_percent)`);
      }
      await tx.commit();
      return true;
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  async fail(id: string, error: string, at: Date): Promise<boolean> {
    const r = await this.pool
      .request()
      .input('id', sql.NVarChar(36), id)
      .input('error', sql.NVarChar(400), error.slice(0, 400))
      .input('at', sql.DateTimeOffset, at)
      .query(`UPDATE dbo.analyses SET status = 'falhou', error = @error, updated_at = @at
              WHERE id = @id AND status = 'em_andamento'`);
    return r.rowsAffected[0] > 0;
  }

  async delete(id: string): Promise<boolean> {
    const r = await this.pool.request().input('id', sql.NVarChar(36), id).query('DELETE FROM dbo.analyses WHERE id = @id');
    return r.rowsAffected[0] > 0;
  }

  async deleteByProcess(processId: string): Promise<number> {
    const r = await this.pool
      .request()
      .input('process_id', sql.NVarChar(64), processId)
      .query('DELETE FROM dbo.analyses WHERE process_id = @process_id');
    return r.rowsAffected[0];
  }
}

function withTimeouts(connectionString: string): string {
  const extra = [];
  if (!/connect(ion)? ?timeout/i.test(connectionString)) extra.push('Connection Timeout=60');
  if (!/encrypt/i.test(connectionString)) extra.push('Encrypt=true');
  return [connectionString.replace(/;$/, ''), ...extra].join(';');
}

function toAnalysis(r: any): Analysis {
  return {
    id: r.id,
    processId: r.process_id,
    processName: r.process_name,
    name: r.name,
    delta: r.delta,
    treatment: r.treatment,
    activity: r.activity,
    status: r.status,
    error: r.error,
    observationCount: r.observation_count,
    smoothingWindow: r.smoothing_window,
    outlierIndices: JSON.parse(r.outlier_indices || '[]'),
    driftCount: r.drift_count,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    completedAt: r.completed_at ? new Date(r.completed_at) : null,
  };
}

function toDrift(r: any): Drift {
  return {
    position: r.position,
    index: r.detection_index,
    anomalyStartIndex: r.anomaly_start_index,
    value: r.value,
    width: r.width,
    estimation: r.estimation,
    meanBefore: r.mean_before,
    meanAfter: r.mean_after,
    changePercent: r.change_percent,
  };
}
