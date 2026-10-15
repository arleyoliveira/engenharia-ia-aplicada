# Implementation Plan: Trace persistido e logs JSON

**Branch**: `015-persisted-request-trace` | **Date**: 2026-09-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/015-persisted-request-trace/spec.md`

## Summary

Todo `POST /chat` ganha um `requestId` (UUID) gerado no servidor, repetido no corpo e no header `X-Request-Id`, inclusive nos erros. O turn `200` grava, na mesma `DatabaseSync` do ops store, um registro em `requests` (métricas) e um `trace_events` por evento (`node` + payload), numa transação. `src/obs/logger.ts` escreve uma linha JSON por evento e uma linha de resumo, só com metadados. `GET /requests/:id` devolve o registro e o trace na ordem. Falha de gravação responde `500` sem deixar linha pela metade.

## Technical Context

**Language/Version**: TypeScript ESM strict, Node.js 22 LTS

**Primary Dependencies**: Express, Zod, `node:sqlite` (`DatabaseSync`), `node:crypto` (`randomUUID`)

**Storage**: SQLite embarcado já usado pelo OpsPilot (`OPSPILOT_DB`, padrão `./data/opspilot.db`). Tabelas novas `requests` e `trace_events` no `initializeSchema` de `SqliteOpsStore`. Testes em `:memory:`

**Testing**: `node:test` + `tsx`. Chat com estratégia fake, sem rede. Logger com sink injetado. Store real em `:memory:`

**Target Platform**: Servidor HTTP do OpsPilot (o processo que sobe em `src/index.ts`)

**Project Type**: Backend / web-service (extensão do `POST /chat` e do store operacional)

**Performance Goals**: Uma transação síncrona por turn `200`; uma leitura por `GET`; uma linha de log por evento de trace mais uma de resumo. Sem chamada extra de modelo

**Constraints**: Header de entrada `X-Request-Id` ignorado; schema estrito do corpo intacto; erro de chat não persiste; log sem payload; statement preparado; typecheck e testes verdes

**Scale/Scope**: Middleware de id, helper único de resposta do `/chat`, store novo sobre o `DatabaseSync` existente, logger, rota GET, wiring em `src/index.ts`

## Constitution Check

*GATE: Passed before Phase 0 and rechecked after Phase 1 design.*

- [x] **I. Camadas explícitas**: SQL só em `SqliteRequestTraceStore`. O grafo e `runChat` não gravam pedido nem logam. O HTTP gera o id, traduz erro e chama store e logger na borda.
- [x] **II. Validação na fronteira**: corpo do `POST /chat` continua no Zod estrito. `GET /requests/:id` valida o id com Zod antes de consultar.
- [x] **III. Erros de domínio**: id ausente no GET usa `NotFoundError` (`NOT_FOUND`) e o formato `{ error: { code, message } }`. Falha de gravação vira `500` `INTERNAL_ERROR` sem mensagem do SQLite. O store não escolhe status HTTP.
- [x] **IV. Teste é parte da tarefa**: logger, store (`:memory:`), `POST /chat` (id, persistência, erro sem registro, falha de save) e `GET`. `npm run typecheck` e `npm run test` verdes.
- [x] **V. Segurança por padrão**: nenhum segredo novo. O log não leva mensagem, resposta nem payload de trace. Sem dotenv.
- [x] **VI. Spec antes do código**: spec + este plano.
- [x] **VII. Persistência embarcada**: mesmo arquivo `OPSPILOT_DB`, `node:sqlite`, statement preparado, testes em `:memory:`. Sem SQL concatenado com entrada externa.

## Project Structure

### Documentation (this feature)

```text
specs/015-persisted-request-trace/
├── checklists/requirements.md
├── contracts/
│   ├── chat-http.md
│   ├── request-log.md
│   └── requests-http.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
└── spec.md
```

### Source Code (repository root)

```text
src/
├── obs/
│   ├── logger.ts                 # NOVO: 1 linha JSON por evento / resumo
│   └── logger.test.ts            # NOVO
├── store/
│   ├── sqlite-ops-store.ts       # DDL requests + trace_events
│   ├── request-trace-store.ts    # NOVO: interface + SqliteRequestTraceStore
│   └── request-trace-store.test.ts
├── services/
│   └── default-store.ts          # getDefaultRequestTraceStore() no mesmo db
├── http/
│   ├── server.ts                 # requestId, persistência, GET /requests/:id
│   └── server.test.ts
└── index.ts                      # injeta o store padrão
```

**Structure Decision**: Projeto único. O DDL fica no `SqliteOpsStore`, como `conversations` e `memories`. A classe nova só recebe o `DatabaseSync` já aberto, para o `:memory:` dos testes ser o mesmo banco. O id nasce no HTTP porque até o JSON inválido precisa de header, antes do `runChat`.

## Phase 0: Research

Decisões em [research.md](research.md): id antes do `express.json`; tabelas no schema compartilhado; transação com serialização dentro dela; trace do GET lido do payload; formato fechado das linhas de log; store padrão no `index.ts` e `:memory:` quando o teste não injeta store.

## Phase 1: Design & Contracts

- Modelo: [data-model.md](data-model.md)
- Contratos: [contracts/chat-http.md](contracts/chat-http.md), [contracts/request-log.md](contracts/request-log.md), [contracts/requests-http.md](contracts/requests-http.md)
- Validação: [quickstart.md](quickstart.md)

## Implementation Sequence

1. DDL de `requests` e `trace_events` em `SqliteOpsStore.initializeSchema`.
2. `RequestTraceStore` + `SqliteRequestTraceStore` (`save` transacional, `findById`). Testes em `:memory:`: N eventos, trace vazio, rollback se o payload não serializa, segundo `save` com o mesmo id não apaga o primeiro.
3. `createRequestLogger` em `src/obs/logger.ts`. Testes do formato: N linhas, chaves permitidas, payload ausente, linha de resumo.
4. `getDefaultRequestTraceStore` em `default-store.ts` e injeção em `src/index.ts`.
5. `POST /chat`: middleware gera `requestId` e ignora o header de entrada; um único helper de saída põe corpo, `X-Request-Id` e as linhas de log. No `200`, `save` antes de logar e responder. `save` que lança → `500` sem linhas de evento. Erros existentes não chamam `save`.
6. `GET /requests/:id`: Zod, `200` com trace ordenado, `404` `NOT_FOUND`, `400` para id vazio ou inválido.
7. Testes HTTP sem rede cobrindo FR-016.
8. `npm run typecheck` e `npm run test` verdes.

## Complexity Tracking

Nenhuma violação constitucional. Store separado sobre o mesmo `DatabaseSync` segue o precedente de `SqliteConversationStore`, não é um segundo banco.
