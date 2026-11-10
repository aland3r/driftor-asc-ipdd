import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DomainErrorFilter } from './domain-error.filter';
import { INestApplication } from '@nestjs/common';

export function configure(app: INestApplication): INestApplication {
  // "*" numa lista não casa com nenhuma origem no pacote cors: sem lista, libera todas.
  const origins = (process.env.CORS_ORIGINS ?? '*').split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origins.includes('*') ? true : origins });
  app.useGlobalFilters(new DomainErrorFilter());
  const config = new DocumentBuilder()
    .setTitle('Driftor ASC · ipdd')
    .setDescription(
      'Microsserviço 2: CRUD de análises de desvios IPDD/ADWIN no Azure SQL. A criação publica analysis-requested; ' +
        'o resultado chega por analysis-completed. Contrato dos eventos em /events.',
    )
    .setVersion('1.0.0')
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config));
  return app;
}

async function bootstrap() {
  const app = configure(await NestFactory.create(await AppModule.fromEnv()));
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
}

if (require.main === module) {
  bootstrap();
}
