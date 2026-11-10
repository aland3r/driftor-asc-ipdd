# Driftor ASC · ipdd

Microsserviço 2 do **Driftor ASC**, entrega 3 de Arquitetura e Soluções Cloud (PUCPR). Guarda as análises de desvios de desempenho (IPDD/ADWIN) no **Azure SQL** e conversa com a Azure Function [driftor-asc-fn-adwin](https://github.com/aland3r/driftor-asc-fn-adwin) por filas do **Azure Service Bus**.

## Na nuvem

| | URL |
|---|---|
| API | https://driftor-asc-ipdd.fly.dev |
| Swagger | https://driftor-asc-ipdd.fly.dev/docs |
| Eventos (AsyncAPI) | https://driftor-asc-ipdd.fly.dev/events |
| Imagem | [aland3r/driftor-asc-ipdd](https://hub.docker.com/r/aland3r/driftor-asc-ipdd) |

O front não chama este serviço direto: o caminho é front → API Management → [BFF](https://github.com/aland3r/driftor-asc-bff) → ipdd.

## Fluxo de uma análise

1. `POST /analyses` com `processId`, `delta`, `treatment` e, opcionalmente, `activity`.
2. O ipdd busca a série do processo no [pmining](https://github.com/aland3r/driftor-asc-pmining), grava a análise como `em_andamento` com os pontos da série e publica `analysis-requested`.
3. A Function roda o ADWIN e publica `analysis-completed`.
4. O ipdd consome a mensagem e grava desvios, outliers e janela de suavização, com status `concluida` ou `falhou`. O consumo é idempotente: só altera análise ainda em andamento.

Quando um processo é excluído no pmining, chega `process-deleted` e o ipdd apaga as análises dele.

## Rotas

| Método | Rota | Para quê |
|---|---|---|
| `POST` | `/analyses` | Cria a análise e pede o cálculo |
| `GET` | `/analyses?processId=` | Lista |
| `GET` | `/analyses/{id}` | Detalhe com desvios, pontos da série e segmentos entre desvios |
| `PATCH` | `/analyses/{id}` | Renomeia |
| `DELETE` | `/analyses/{id}` | Exclui |

## Filas

| Fila | Publica | Consome |
|---|---|---|
| `analysis-requested` | ipdd | fn-adwin |
| `analysis-completed` | fn-adwin | ipdd |
| `process-deleted` | pmining | ipdd |

Os contratos estão em [`docs/asyncapi.yaml`](docs/asyncapi.yaml).

## Arquitetura

Clean Architecture com fatias verticais:

```
src/
  domain/          análise, desvio, segmentos e validações; sem nenhum import externo
  application/     uma pasta por caso de uso
    create-analysis/  complete-analysis/  list-analyses/  get-analysis/
    rename-analysis/  delete-analysis/    purge-process-analyses/
    ports.ts         interfaces de repositório, gateway do pmining, publicador, relógio
  infrastructure/  Azure SQL (mssql), Service Bus, cliente HTTP do pmining, repositório em memória
  api/             NestJS: controllers, DTOs do Swagger, composição
```

Tabelas no banco `ipdd`: `analyses`, `drifts` e `analysis_points`, criadas na subida do serviço.

Os testes de arquitetura rodam o [dependency-cruiser](.dependency-cruiser.cjs) e garantem que:

- o domínio não importa nada de fora;
- a aplicação não importa infraestrutura, API, `mssql` nem `@azure`;
- uma fatia não importa outra;
- não há ciclos.

## Tecnologias

Node 20, TypeScript, NestJS, Swagger (OpenAPI), mssql, Azure SQL, Azure Service Bus, AsyncAPI, Jest, Supertest, dependency-cruiser, Docker, GitHub Actions, Fly.io.

## Rodar localmente

```bash
npm ci
npm test                 # unitários, e2e e arquitetura
cp .env.example .env     # sem AZURE_SQL_CONNECTION, usa repositório em memória
npm run build && node --env-file=.env dist/api/main.js
```

Ou com Docker:

```bash
docker run -p 8080:8080 --env-file .env aland3r/driftor-asc-ipdd:v1
```

## Pipeline

A cada push na `main`, o GitHub Actions roda os testes, publica a imagem no Docker Hub (`v1` e o hash do commit) e implanta essa imagem no Fly.io. Secrets usados: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `FLY_API_TOKEN`, `AZURE_SQL_CONNECTION`, `SERVICEBUS_CONNECTION`.

## Grupo

- Alander Menezes Arantes de Ávila
- Emanuelle Skolut Jose
