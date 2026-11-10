import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiCreatedResponse, ApiNoContentResponse, ApiQuery, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CreateAnalysisHandler } from '../application/create-analysis/handler';
import { DeleteAnalysisHandler } from '../application/delete-analysis/handler';
import { GetAnalysisHandler } from '../application/get-analysis/handler';
import { ListAnalysesHandler } from '../application/list-analyses/handler';
import { RenameAnalysisHandler } from '../application/rename-analysis/handler';
import { AnalysisDetailDto, AnalysisDto, CreateAnalysisDto, RenameAnalysisDto } from './dto';

@ApiTags('Análises')
@Controller('analyses')
export class AnalysesController {
  constructor(
    private readonly createAnalysis: CreateAnalysisHandler,
    private readonly listAnalyses: ListAnalysesHandler,
    private readonly getAnalysis: GetAnalysisHandler,
    private readonly renameAnalysis: RenameAnalysisHandler,
    private readonly deleteAnalysis: DeleteAnalysisHandler,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Cria a análise (status em_andamento) e publica analysis-requested' })
  @ApiCreatedResponse({ type: AnalysisDto })
  create(@Body() body: CreateAnalysisDto) {
    return this.createAnalysis.handle({
      processId: body?.processId,
      name: body?.name,
      delta: body?.delta === undefined ? undefined : Number(body.delta),
      treatment: body?.treatment,
      activity: body?.activity ?? null,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Lista as análises, opcionalmente de um processo' })
  @ApiQuery({ name: 'processId', required: false })
  @ApiOkResponse({ type: [AnalysisDto] })
  list(@Query('processId') processId?: string) {
    return this.listAnalyses.handle(processId || undefined);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe com desvios, série e segmentos' })
  @ApiOkResponse({ type: AnalysisDetailDto })
  get(@Param('id') id: string) {
    return this.getAnalysis.handle(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Renomeia a análise' })
  @ApiOkResponse({ type: AnalysisDetailDto })
  async rename(@Param('id') id: string, @Body() body: RenameAnalysisDto) {
    await this.renameAnalysis.handle(id, body?.name);
    return this.getAnalysis.handle(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Exclui a análise' })
  @ApiNoContentResponse()
  async remove(@Param('id') id: string) {
    await this.deleteAnalysis.handle(id);
  }
}
