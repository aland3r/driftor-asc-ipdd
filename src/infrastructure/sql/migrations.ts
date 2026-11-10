/** Esquema do Azure SQL, criado na subida do serviço (idempotente). */
export const MIGRATIONS: string[] = [
  `IF OBJECT_ID('dbo.analyses', 'U') IS NULL
   CREATE TABLE dbo.analyses (
     id                NVARCHAR(36)   NOT NULL PRIMARY KEY,
     process_id        NVARCHAR(64)   NOT NULL,
     process_name      NVARCHAR(200)  NOT NULL,
     name              NVARCHAR(200)  NOT NULL,
     delta             FLOAT          NOT NULL,
     treatment         NVARCHAR(16)   NOT NULL,
     activity          NVARCHAR(160)  NULL,
     status            NVARCHAR(16)   NOT NULL,
     error             NVARCHAR(400)  NULL,
     observation_count INT            NOT NULL,
     smoothing_window  INT            NULL,
     outlier_indices   NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
     drift_count       INT            NOT NULL DEFAULT 0,
     created_at        DATETIMEOFFSET NOT NULL,
     updated_at        DATETIMEOFFSET NOT NULL,
     completed_at      DATETIMEOFFSET NULL
   )`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_analyses_process')
   CREATE INDEX ix_analyses_process ON dbo.analyses (process_id)`,
  `IF OBJECT_ID('dbo.drifts', 'U') IS NULL
   CREATE TABLE dbo.drifts (
     analysis_id         NVARCHAR(36) NOT NULL REFERENCES dbo.analyses(id) ON DELETE CASCADE,
     position            INT          NOT NULL,
     detection_index     INT          NOT NULL,
     anomaly_start_index INT          NOT NULL,
     value               FLOAT        NOT NULL,
     width               FLOAT        NOT NULL,
     estimation          FLOAT        NOT NULL,
     mean_before         FLOAT        NOT NULL,
     mean_after          FLOAT        NOT NULL,
     change_percent      FLOAT        NOT NULL,
     PRIMARY KEY (analysis_id, position)
   )`,
  `IF OBJECT_ID('dbo.analysis_points', 'U') IS NULL
   CREATE TABLE dbo.analysis_points (
     analysis_id NVARCHAR(36)  NOT NULL REFERENCES dbo.analyses(id) ON DELETE CASCADE,
     idx         INT           NOT NULL,
     case_id     NVARCHAR(128) NOT NULL,
     value       FLOAT         NOT NULL,
     PRIMARY KEY (analysis_id, idx)
   )`,
];
