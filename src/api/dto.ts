import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAnalysisDto {
  @ApiProperty({ description: 'Id do processo no pmining' }) processId!: string;
  @ApiPropertyOptional({ description: 'Nome; se vazio, é gerado a partir do processo e da data' }) name?: string;
  @ApiPropertyOptional({ default: 0.002, description: 'Confiança δ do ADWIN' }) delta?: number;
  @ApiPropertyOptional({ enum: ['raw', 'treated'], default: 'raw' }) treatment?: string;
  @ApiPropertyOptional({ description: 'Atividade cuja permanência forma a série; vazio = duração do trace', example: 'Machine_Operating' })
  activity?: string;
}

export class RenameAnalysisDto {
  @ApiProperty() name!: string;
}

export class DriftDto {
  @ApiProperty() position!: number;
  @ApiProperty() index!: number;
  @ApiProperty() anomalyStartIndex!: number;
  @ApiProperty() value!: number;
  @ApiProperty() width!: number;
  @ApiProperty() estimation!: number;
  @ApiProperty() meanBefore!: number;
  @ApiProperty() meanAfter!: number;
  @ApiProperty() changePercent!: number;
}

export class PointDto {
  @ApiProperty() index!: number;
  @ApiProperty() caseId!: string;
  @ApiProperty() value!: number;
}

export class SegmentDto {
  @ApiProperty() id!: string;
  @ApiProperty() label!: string;
  @ApiProperty() startIndex!: number;
  @ApiProperty() endIndex!: number;
  @ApiProperty() traceCount!: number;
  @ApiProperty() mean!: number;
  @ApiProperty() outlierCount!: number;
  @ApiProperty() driftCount!: number;
}

export class AnalysisDto {
  @ApiProperty() id!: string;
  @ApiProperty() processId!: string;
  @ApiProperty() processName!: string;
  @ApiProperty() name!: string;
  @ApiProperty() delta!: number;
  @ApiProperty({ enum: ['raw', 'treated'] }) treatment!: string;
  @ApiProperty({ nullable: true, type: String }) activity!: string | null;
  @ApiProperty({ enum: ['em_andamento', 'concluida', 'falhou'] }) status!: string;
  @ApiProperty({ nullable: true, type: String }) error!: string | null;
  @ApiProperty() observationCount!: number;
  @ApiProperty({ nullable: true, type: Number }) smoothingWindow!: number | null;
  @ApiProperty({ type: [Number] }) outlierIndices!: number[];
  @ApiProperty() driftCount!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty({ nullable: true, type: Date }) completedAt!: Date | null;
}

export class AnalysisDetailDto extends AnalysisDto {
  @ApiProperty({ type: [DriftDto] }) drifts!: DriftDto[];
  @ApiProperty({ type: [PointDto] }) points!: PointDto[];
  @ApiProperty({ type: [SegmentDto] }) segments!: SegmentDto[];
}
