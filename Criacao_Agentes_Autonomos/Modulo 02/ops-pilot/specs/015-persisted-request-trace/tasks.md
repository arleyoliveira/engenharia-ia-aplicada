---

description: "Task list for persisted request trace and JSON logs"
---

# Tasks: Trace persistido e logs JSON

**Input**: Design documents from `/specs/015-persisted-request-trace/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, constitution

**Tests**: Spec exige suíte sem rede (FR-016): `requestId` no corpo e em `X-Request-Id`, `requests` / `trace_events` fiéis ao `200`, log JSON sem payload, `GET /requests/:id`. Ver [contracts/chat-http.md](contracts/chat-http.md), [contracts/request-log.md](contracts/request-log.md), [contracts/requests-http.md](contracts/requests-http.md) e [quickstart.md](quickstart.md).

**Organization**: Por história. US1 e US2 são P1; US3 e US4 são P2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos distintos, sem dependência incompleta)
- **[Story]**: US1 / US2 / US3 / US4
- Incluir caminhos de arquivo exatos

## Path Conventions

- Projeto único: `src/` na raiz, testes `src/**/*.test.ts` (`node:test` + `tsx`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Tabelas novas no SQLite já aberto pelo OpsPilot. Sem pacote novo e sem variável de ambiente nova.

- [X] T001 Em `src/store/sqlite-ops-store.ts` (`initializeSchema`), criar `requests` (`id` TEXT PK, `conversation_id` TEXT NOT NULL, `created_at` TEXT NOT NULL, `metrics_json` TEXT NOT NULL) e `trace_events` (`request_id`, `position` INTEGER CHECK ≥ 0, `node` TEXT NOT NULL, `payload_json` TEXT NOT NULL, PK (`request_id`, `position`)). `CREATE TABLE IF NOT EXISTS`. Sem FK para `conversations`. Não concatenar SQL com entrada externa ([data-model.md](data-model.md))

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: O schema da Phase 1 abre no banco em memória. Bloqueia o store da US2.

**⚠️ CRITICAL**: Nenhuma história começa antes desta fase

- [X] T002 Rodar `npm run test -- src/store/sqlite-ops-store.test.ts` e corrigir `src/store/sqlite-ops-store.ts` se o DDL novo impedir `new SqliteOpsStore(":memory:")`

**Checkpoint**: Banco existente sobe com as tabelas novas; ainda não há `requestId` no HTTP

---

## Phase 3: User Story 1 - Cada chat tem um identificador de correlação (Priority: P1) 🎯 MVP

**Goal**: Todo `POST /chat` devolve o mesmo `requestId` no corpo e no header `X-Request-Id`. O id é UUID do servidor. O header de entrada é ignorado.

**Independent Test**: `npm run test -- src/http/server.test.ts` sem rede. `200` e um erro trazem o mesmo id no JSON e no header. Duas chamadas diferem. `X-Request-Id` enviado pelo cliente não volta na resposta.

### Tests for User Story 1

> Escrever primeiro; devem falhar até o helper de saída existir.

- [X] T003 [US1] Em `src/http/server.test.ts`: `POST /chat` `200` (estratégia fake já usada no arquivo) tem `requestId` string não vazia e o header `X-Request-Id` é exatamente esse valor. Dois POST seguidos geram ids diferentes
- [X] T004 [US1] Em `src/http/server.test.ts`: JSON inválido e corpo com campo extra (inclusive `requestId`) continuam `400` e trazem `requestId` no corpo e em `X-Request-Id`. Um `X-Request-Id` de entrada diferente não é ecoado. Os casos já cobertos de `422` (estratégia desconhecida) e `404` (conversa inexistente) também exigem o par corpo/header

### Implementation for User Story 1

- [X] T005 [US1] Em `src/http/server.ts`, middleware **antes** de `express.json()`: em `POST /chat`, gravar `randomUUID()` em `res.locals.requestId`. Não ler o header de entrada. Um único helper de saída coloca `X-Request-Id` e `requestId` em todo retorno do `POST /chat` (`200`, `400` com `issues`, `404` / `422` / `500` / `503` / `504` com `error`, e `badJsonResponse`). Nenhum `response.json` desse verbo fora do helper. Ainda não gravar nem logar ([contracts/chat-http.md](contracts/chat-http.md), research R1)

**Checkpoint**: US1 — id estável na resposta; nada é persistido

---

## Phase 4: User Story 2 - O turn bem-sucedido fica gravado (Priority: P1)

**Goal**: O `200` grava uma linha em `requests` (métricas) e uma em `trace_events` por evento (`node` + payload), na ordem do `trace`. Erro de chat não grava. Falha de `save` não devolve `200` e não deixa linha pela metade.

**Independent Test**: `npm run test -- src/store/request-trace-store.test.ts src/http/server.test.ts` sem rede. Store em `:memory:`. N eventos batem com o trace; trace vazio grava só o pedido; payload circular deixa zero linhas; store que lança produz `500` e `findById` nulo.

### Tests for User Story 2

- [X] T006 [P] [US2] Em `src/store/request-trace-store.test.ts`, com `SqliteOpsStore(":memory:")`: `save` de N eventos grava uma linha em `requests` com `metrics_json` igual ao objeto passado e N linhas em `trace_events` (`position` 0..N-1, `node` = `event.node ?? ""`, `payload_json` profundo-igual ao evento). `findById` devolve `conversationId`, `createdAt` ISO-8601 e `trace` na mesma ordem. Trace vazio: pedido existe e zero eventos. Payload circular (stringify dentro da transação) faz `save` lançar e `findById` voltar `null`. Segundo `save` com o mesmo `requestId` lança e o primeiro registro permanece intacto ([data-model.md](data-model.md))
- [X] T007 [US2] Em `src/http/server.test.ts`: injetar `SqliteRequestTraceStore` sobre `:memory:`. `200` → `findById` com as métricas e o trace da resposta. `400` → `findById` nulo. Store cujo `save` lança → status `500`, `error.code` `INTERNAL_ERROR`, mensagem sem texto de SQL, `requestId` no corpo e no header, e `findById` nulo

### Implementation for User Story 2

- [X] T008 [US2] Em `src/store/request-trace-store.ts`, exportar `RequestTraceStore` e `SqliteRequestTraceStore(db)`. `save` faz `BEGIN`, insere `requests` (`created_at` = `new Date().toISOString()`), serializa cada payload **dentro** da transação e insere `trace_events` com statement preparado, `COMMIT`. No `catch`, `ROLLBACK` e relança. `findById` lê `ORDER BY position ASC` e reconstrói `trace` só de `payload_json` (não da coluna `node`). Id ausente → `null` ([data-model.md](data-model.md), research R3–R4)
- [X] T009 [US2] Em `src/http/server.ts`, no caminho do `200`, chamar `save` **antes** de responder, com `requestId`, `conversationId`, `metrics` e `trace` do `runChat`. `save` que lança → helper com `500` `INTERNAL_ERROR` e mensagem fixa sem detalhe de SQLite; não responder `200`. Ramos de erro do chat (`400`, `404`, `422`, `500`, `503`, `504`) não chamam `save`. Se `requestTraceStore` vier omitido, criar `SqliteOpsStore(":memory:")` dessa instância e um `SqliteRequestTraceStore` em cima dele ([contracts/chat-http.md](contracts/chat-http.md), research R6)
- [X] T010 [US2] Em `src/services/default-store.ts`, exportar `getDefaultRequestTraceStore()` reutilizando o `SqliteOpsStore` em cache (mesmo `OPSPILOT_DB`), no estilo de `getDefaultConversationStore`. Limpar o cache em `resetDefaultStore`. Em `src/index.ts`, passar esse store para `createChatServer`

**Checkpoint**: US2 — `200` consultável no store; erro e falha de gravação não deixam pedido

---

## Phase 5: User Story 3 - Log JSON por evento, sem payload (Priority: P2)

**Goal**: Cada evento de trace de um `200` vira uma linha JSON de metadados. Todo `POST /chat` escreve uma linha de resumo. Payload não aparece.

**Independent Test**: `npm run test -- src/obs/logger.test.ts src/http/server.test.ts` sem rede. N eventos → N linhas `kind: "trace"` mais uma `kind: "request"`. O texto do payload não está na saída. Erro → só o resumo, com o status HTTP.

### Tests for User Story 3

- [X] T011 [P] [US3] Em `src/obs/logger.test.ts`, sink em memória: N chamadas de evento escrevem N linhas, cada uma um JSON com exatamente `ts`, `level` `"info"`, `kind` `"trace"`, `requestId`, `seq`, `type`, `node` (vazio se omitido), nessa ordem de `seq`. Uma chamada de resumo com `status` 200 acrescenta uma linha com `metrics` e sem as chaves `content`, `args`, `steps`, `reason`, `tool`, `from`, `to`. Resumo de erro não tem `metrics`. A string distintiva de um payload passado ao teste não aparece em linha alguma. Cada escrita termina em `\n` e não é pretty-print ([contracts/request-log.md](contracts/request-log.md))
- [X] T012 [US3] Em `src/http/server.test.ts`, logger com sink injetado: `200` com trace conhecido emite as linhas `kind: "trace"` na ordem e depois uma `kind: "request"` com `status` 200 e `metrics`. Trace vazio: só o resumo. `400`: só o resumo, `status` 400, sem `metrics`. O conteúdo do evento de trace não aparece no sink

### Implementation for User Story 3

- [X] T013 [US3] Em `src/obs/logger.ts`, exportar `createRequestLogger(sink?)`. Sink padrão: `(line) => process.stdout.write(line)`. `traceEvent` e `request` escrevem exatamente uma linha cada, no formato de T011. Nenhuma outra chave ([contracts/request-log.md](contracts/request-log.md), research R5)
- [X] T014 [US3] Em `src/http/server.ts`, o helper de saída chama o logger **depois** de um `save` bem-sucedido no `200`: uma linha `trace` por evento (`seq` = índice, `type`, `node`) e em seguida a linha `request` com `metrics`. Nos erros, só a linha `request` com o status, sem `metrics` e sem linhas de evento (inclusive no `500` de falha de `save`). Exceção do sink depois do `save` não muda o `200`. Logger omitido usa `createRequestLogger()`. `GET` não escreve linha

**Checkpoint**: US3 — log correlaciona pelo `requestId` e não vaza o turn

---

## Phase 6: User Story 4 - Consultar o pedido pelo id (Priority: P2)

**Goal**: `GET /requests/:id` devolve o registro e o trace na ordem do chat. UUID desconhecido é `404`. Id inválido é `400`. A leitura não grava.

**Independent Test**: `npm run test -- src/http/server.test.ts` sem rede. Depois de um `200`, o GET devolve as mesmas métricas e o mesmo trace. UUID novo é `404` `NOT_FOUND` e não insere linha. Id que não é UUID é `400`.

### Tests for User Story 4

- [X] T015 [US4] Em `src/http/server.test.ts`: após `POST /chat` `200`, `GET /requests/{requestId}` é `200` com `requestId`, `conversationId`, `createdAt`, `metrics` e `trace` profundo-iguais ao chat (trace vazio incluso). Repetir o GET não muda ordem nem conteúdo. UUID válido nunca gravado (e o `requestId` de um `400`) → `404` `{ error: { code: "NOT_FOUND", message } }` e a contagem de `requests` não aumenta. `id` que não é UUID, vazio ou só espaços → `400` `{ issues }`. Esse GET não envia `X-Request-Id` ([contracts/requests-http.md](contracts/requests-http.md))

### Implementation for User Story 4

- [X] T016 [US4] Em `src/http/server.ts`, `GET /requests/:id`: trim; vazio ou não-UUID → `400` com `issues` do Zod (`z.string().uuid()`). UUID ausente em `findById` → `NotFoundError` e `404` `{ error: { code: "NOT_FOUND", message } }`. Acerto → `200` com o `ChatRequestRecord`. Não gerar outro `requestId`, não chamar `save`, não logar (research R7)

**Checkpoint**: US4 — o id do chat reabre o turn; leitura não cria registro

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Suíte inteira e quickstart.

- [X] T017 [P] Rodar `npm run test -- src/obs/logger.test.ts src/store/request-trace-store.test.ts src/store/sqlite-ops-store.test.ts src/http/server.test.ts` e corrigir regressões desses arquivos
- [X] T018 Executar `npm run typecheck` e `npm run test` até verdes; conferir os cinco itens de [quickstart.md](quickstart.md)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências
- **Foundational (Phase 2)**: Depois de T001 — **bloqueia** as histórias
- **US1 (Phase 3)**: Depois da Phase 2 — MVP (não usa as tabelas)
- **US2 (Phase 4)**: Store (T006–T008) depois da Phase 2. Wiring HTTP (T009) depois de T005 e T008. `index.ts` (T010) depois de T008
- **US3 (Phase 5)**: Logger (T011–T013) não depende do store. Wiring (T014) depois de T005 e T009, para logar só após `save` bem-sucedido
- **US4 (Phase 6)**: Depois de T008 e T009 (o GET lê o que o `200` gravou)
- **Polish (Phase 7)**: Depois das histórias desejadas

### User Story Dependencies

- **US1 (P1)**: Só o helper HTTP. Não grava e não loga
- **US2 (P1)**: O teste de store não precisa da US1. O `POST` que grava usa o `requestId` da US1
- **US3 (P2)**: O teste do logger é isolado. A prova no `POST /chat` depende do helper da US1 e do `save` da US2
- **US4 (P2)**: Depende do store e do `200` que persiste. Não depende do logger

### Within Each User Story

- Testes primeiro (devem falhar) → implementação → checkpoint
- T003 e T004 no mesmo `server.test.ts`: T004 depois de T003
- T006 antes de T008; T007 antes de T009; T009 depois de T008
- T011 antes de T013; T012 antes de T014; T014 depois de T013 e T009
- T015 antes de T016; T016 depois de T008

### Parallel Opportunities

- T006 (`request-trace-store.test.ts`) e T011 (`logger.test.ts`) depois da Phase 2, em paralelo com a US1 (`server.ts` / `server.test.ts`)
- T008 (`request-trace-store.ts`) e T013 (`logger.ts`) em paralelo, cada um depois do próprio teste
- T010 (`default-store.ts`, `index.ts`) em paralelo com T011–T013, depois de T008
- T017 em paralelo com a leitura do quickstart, antes de T018 fechar a suíte

---

## Parallel Example: User Story 2 e o logger

```bash
# Testes em arquivos distintos, depois da Phase 2:
Task: "T006 store em src/store/request-trace-store.test.ts"
Task: "T011 logger em src/obs/logger.test.ts"

# Implementação em arquivos distintos, depois do teste de cada um:
Task: "T008 SqliteRequestTraceStore em src/store/request-trace-store.ts"
Task: "T013 createRequestLogger em src/obs/logger.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup (DDL)
2. Phase 2 Foundational (teste do schema)
3. Phase 3 US1 (id no corpo e no header)
4. **STOP**: `src/http/server.test.ts` verde para o par `requestId` / `X-Request-Id` no `200` e no erro
5. Seguir US2 (persistência) → US3 (log) → US4 (GET) → Polish

### Incremental Delivery

1. Setup + Foundational → tabelas no sqlite existente
2. US1 → correlação na resposta do chat (MVP)
3. US2 → `200` gravado; erro e falha de `save` sem linha órfã
4. US3 → uma linha JSON por evento, só metadados
5. US4 → `GET /requests/:id` ordenado
6. Polish → `npm run typecheck` e `npm run test` verdes

### Parallel Team Strategy

1. Juntos: Setup + Foundational
2. Dev A: US1 em `src/http/server.ts` (o helper bloqueia o wiring de US2 e US3)
3. Em paralelo com a US1: Dev B no store (T006–T008), Dev C no logger (T011–T013)
4. Depois do helper e do store: wiring do `save`, do log e do GET no mesmo `server.ts`, em sequência

---

## Notes

- [P] = arquivos distintos, sem dependência incompleta
- `requestId` é `randomUUID()` do servidor; header de entrada não entra no corpo nem na resposta
- Só o `200` chama `save`. A transação serializa o payload depois do insert do pedido
- Linhas de evento só existem quando a resposta é `200`. O resumo existe em todo `POST /chat`
- `GET` não gera id, não grava e não loga
- Commit após cada tarefa ou grupo lógico; marcar `[x]` em `tasks.md` na implementação
