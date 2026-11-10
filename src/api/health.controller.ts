import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { readFileSync } from 'fs';
import { join } from 'path';

@ApiTags('Saúde')
@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'ipdd' };
  }

  /** Contrato dos eventos (AsyncAPI), o "Swagger de eventos". */
  @Get('asyncapi.yaml')
  @Header('Content-Type', 'text/yaml; charset=utf-8')
  @ApiExcludeEndpoint()
  asyncapi() {
    return readFileSync(join(__dirname, '..', '..', 'docs', 'asyncapi.yaml'), 'utf-8');
  }

  @Get('events')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiExcludeEndpoint()
  events() {
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Eventos · Driftor ASC</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/@asyncapi/react-component@1.4.10/styles/default.min.css"></head>
<body><div id="asyncapi"></div>
<script src="https://unpkg.com/@asyncapi/react-component@1.4.10/browser/standalone/index.js"></script>
<script>AsyncApiStandalone.render({ schema: { url: './asyncapi.yaml' }, config: { show: { sidebar: true } } }, document.getElementById('asyncapi'));</script>
</body></html>`;
  }
}
