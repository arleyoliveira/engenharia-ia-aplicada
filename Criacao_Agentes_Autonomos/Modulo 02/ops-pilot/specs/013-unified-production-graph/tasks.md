---
description: "Task list for the unified production graph"
---

# Tasks: Grafo unificado de produção

**Input**: Design documents from `/specs/013-unified-production-graph/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, constitution

**Tests**: Spec exige suíte sem rede (FR-012): ordem dos nós e exclusividade da estratégia; tabela no prompt; evento `route` com `route`/`reason`/`override`/`node`; `node` em todo evento; override não invoca o roteador; `strategy` omitida não vira `react`; `strategy` desconhecida → `422`. Ver [contracts/](contracts/) e [quickstart.md](quickstart.md).

**Organization**: Por história. Contratos: [contracts/production-graph.md](contracts/production-graph.md), [contracts/trace-route.md](contracts/trace-route.md), [contracts/chat-http.md](contracts/chat-http.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos distintos, sem dependência incompleta)
- **[Story]**: US1 / US2 / US3
- Incluir caminhos de arquivo exatos

## Path Conventions

- Projeto único: `src/agents/`, `src/services/`, `src/http/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Constantes, tipo do evento `route` e esqueleto do módulo pedido.

- [X] T001 Criar `src/agents/production-graph.ts` exportando `PRODUCTION_ROUTES` (`react` | `plan-and-execute` | `reflection`), o tipo `ProductionRoute`, `OVERRIDE_REASON` = `estratégia informada pelo cliente` e `ROUTER_PROMPT` com a tabela markdown de [contracts/production-graph.md](contracts/production-graph.md) (três linhas e os critérios literais)
- [X] T002 [P] Em `src/agents/types.ts`: acrescentar a variante `{ type: "route"; route: ProductionRoute; reason: string; override: boolean; node: "roteador" }` e o campo opcional `node?: string` nas variantes já existentes (`thought`, `action`, `observation`, `plan`, `critique`, `answer`, `summarize`)
- [X] T003 [P] Criar esqueleto `src/agents/production-graph.test.ts` (`node:test` + `tsx`) importando `PRODUCTION_ROUTES`, `OVERRIDE_REASON` e `ROUTER_PROMPT`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Carimbo de `node` e linha estável de `formatTrace` — bloqueia as histórias que emitem trace.

**⚠️ CRITICAL**: Nenhuma história começa antes desta fase

- [X] T004 Em `src/agents/production-graph.ts`: implementar `stampTraceNode(events, base)` com `base` = `react` | `plan-and-execute` — evento `critique` recebe `node: "reflection"`; os demais recebem `node` = `base`; não alterar `type` nem os outros campos ([data-model.md](data-model.md))
- [X] T005 [P] Em `src/agents/trace.ts`: no `formatTrace`, serializar `route` como `[route] <route> override=<true|false> <reason>` sem imprimir `node`; não mudar o texto de `thought`, `action`, `observation`, `plan`, `critique`, `answer` e `summarize` ([contracts/trace-route.md](contracts/trace-route.md))
- [X] T006 [P] Em `src/agents/trace.test.ts`: caso com `{ type: "route", route: "plan-and-execute", reason: "estratégia informada pelo cliente", override: true, node: "roteador" }` produz essa linha; um trace misto mantém as linhas antigas de `thought` / `action` / `plan` / `answer`

**Checkpoint**: Tipos, prompt, carimbo e formatação testáveis sem grafo e sem rede

---

## Phase 3: User Story 1 - Um único grafo executa o turn (Priority: P1) 🎯 MVP

**Goal**: Cada turn de produção visita `contexto` → `roteador` → exatamente uma estratégia → `resposta`. O nó `contexto` é o único que chama `buildContext`. A estratégia escolhida recebe o material orçado. `resposta` devolve o `answer` dessa estratégia, sem um segundo.

**Independent Test**: `npm run test -- src/agents/production-graph.test.ts` com `routeModel` e estratégias fakes — `visited` na ordem, só uma estratégia com `run`, input orçado. Sem rede.

### Tests for User Story 1

> Escrever primeiro; devem falhar até `runProductionGraph` e o wiring de `runChat`.

- [X] T007 [P] [US1] Em `src/agents/production-graph.test.ts`: `routeModel` devolve `{ route: "react", reason: "consulta curta" }`; três estratégias fakes contam `run`; `visited` é `["contexto", "roteador", "react", "resposta"]`; `plan-and-execute` e `reflection` ficam em zero; o fake `react` recebe `history`/`memories`/`summary` já cortados quando o input estoura um `SectionBudgets` baixo passado ao grafo
- [X] T008 [P] [US1] Em `src/agents/production-graph.test.ts`: três invokes, `routeModel` devolvendo cada uma de `PRODUCTION_ROUTES`; em cada invoke só o `run` daquela rota é 1 e os outros dois são 0
- [X] T009 [P] [US1] Em `src/services/run-chat.test.ts`: trocar o `deps.strategy` único por deps do grafo (`strategies.react` = fake atual, `routeModel` devolve `react`); o `lastInput` do fake continua orçado; `metrics.historyMessages` / `recalledMemories` / `contextBreakdown` batem com esse input; nenhum teste chama estratégia fora do grafo

### Implementation for User Story 1

- [X] T010 [US1] Em `src/agents/production-graph.ts`: implementar `runProductionGraph(input, deps)` com `StateGraph` (`StateSchema`, `ReducedValue` no trace, como `src/agents/plan-and-execute.ts`). Nós: `contexto` chama `buildContext` e grava o orçado; `roteador` chama `deps.routeModel.invoke` só quando `input.strategy` está ausente e grava a rota; aresta condicional para um único id de `PRODUCTION_ROUTES`; esse nó chama `deps.strategies[route].run` com `ChatTurnInput` orçado e `tools`; `resposta` repassa `answer`, `trace` e `metrics` da estratégia (sem evento `answer` extra). Registrar `visited` com os quatro ids. Default de produção, se `deps` omitir estratégias: `reactStrategy`, `planAndExecuteStrategy` e `withReflection(reactStrategy)` ([contracts/production-graph.md](contracts/production-graph.md))
- [X] T011 [US1] Em `src/services/run-chat.ts`: depois de janela, resumo, recall e tools, deixar de chamar `buildContext` e `strategy.run`; invocar `runProductionGraph` com message, history, memories (com `score`), summary, budgets, tools e `strategy`/`reflect` ainda opcionais. Manter append da conversa e `scheduleLearningRemember` em `runChat`. `RunChatDeps.strategy` sai; entra `strategies` + `routeModel` opcional

**Checkpoint**: US1 — um turn fake percorre o grafo, uma estratégia só, contexto orçado

---

## Phase 4: User Story 2 - O roteador explica a escolha e cada evento diz o nó (Priority: P1)

**Goal**: Sem override, o prompt do roteador leva a tabela, o trace tem um evento `route` fiel à saída estruturada e todo evento tem `node`. Saída inválida é `ModelOutputError`, sem fallback e sem rodar estratégia.

**Independent Test**: Injetar `{ route, reason }` e uma saída inválida em `src/agents/production-graph.test.ts`. Sem rede.

### Tests for User Story 2

- [X] T012 [P] [US2] Em `src/agents/production-graph.test.ts`: o `invoke` do `routeModel` recebe `system` cujo `content` é `ROUTER_PROMPT` (as três rotas e os três critérios da tabela) e `user` com a mensagem orçada
- [X] T013 [P] [US2] Em `src/agents/production-graph.test.ts`: trace tem exatamente um evento `type: "route"` com o `route` e o `reason` devolvidos, `override: false` e `node: "roteador"`; todo evento do array tem `node` não vazio
- [X] T014 [P] [US2] Em `src/agents/production-graph.test.ts`: `routeModel` que lança, devolve `{}`, `reason: "  "` ou `route: "custom"` faz `runProductionGraph` rejeitar com `ModelOutputError` e deixa os três `run` em zero
- [X] T015 [P] [US2] Em `src/agents/production-graph.test.ts`: `summarizeContent` presente → o primeiro evento é `{ type: "summarize", node: "contexto" }` e o `route` vem logo depois
- [X] T016 [P] [US2] Em `src/agents/production-graph.test.ts`: fake que devolve `thought` + `critique` + `answer` — com rota `react`, `node` é `react` / `reflection` / `react`; com rota `reflection`, `thought` e `answer` ficam `react` e `critique` fica `reflection`

### Implementation for User Story 2

- [X] T017 [US2] Em `src/agents/production-graph.ts`: o nó `roteador` monta `[{ role: "system", content: ROUTER_PROMPT }, { role: "user", content: message orçada }]`; valida `route` no enum do turn e `reason` trimada não vazia; senão lança `ModelOutputError` (uma retentativa só no caminho do `createModel()`, não no fake); anexa o evento `route` com `override: false` e `node: "roteador"`
- [X] T018 [US2] Em `src/agents/production-graph.ts`: o nó `contexto` anexa `summarize` com `node: "contexto"` quando `summarizeContent` vier; o nó da estratégia passa o trace por `stampTraceNode` (base `react` quando a rota é `reflection`)
- [X] T019 [US2] Em `src/agents/production-graph.ts`: no nó `resposta`, `llmCalls` e `promptTokens` somam a chamada do roteador (1 e o usage, ou 0 se o modelo não rodou) com as métricas da estratégia; `latencyMs` é a parede de `runProductionGraph`; `historyMessages`, `recalledMemories` e `contextBreakdown` vêm do `buildContext`

**Checkpoint**: US2 — decisão observável, `node` em todo evento, saída inválida não escolhe estratégia

---

## Phase 5: User Story 3 - O cliente força a estratégia e o trace marca o override (Priority: P2)

**Goal**: `strategy` no `POST /chat` é opcional. Válida, é override: o modelo do roteador não roda e o evento `route` marca `override: true`. Fora das três rotas, `422` antes do grafo. Omitida, o roteador decide (sem default `react`).

**Independent Test**: `npm run test -- src/http/server.test.ts` com roteador que lança se for chamado e `strategy: "plan-and-execute"`. Sem rede.

### Tests for User Story 3

- [X] T020 [P] [US3] Em `src/agents/production-graph.test.ts`: `strategy: "plan-and-execute"` e `routeModel.invoke` que lança → não lança, `invoke` não é chamado, só essa estratégia roda, evento `route` tem `override: true`, `route: "plan-and-execute"`, `reason` = `OVERRIDE_REASON`, `node: "roteador"`
- [X] T021 [P] [US3] Em `src/agents/production-graph.test.ts`: `reflect: true` sem `strategy` e `routeModel` devolvendo `reflection` → `ModelOutputError` (enum só `react` | `plan-and-execute`); `reflect: true` com `strategy: "react"` e crítico fake (`withStructuredOutput` → `{ approved: true, feedback: "ok" }`, no estilo de `src/agents/reflection.test.ts`) → evento `route` com `route: "react"` e `override: true`, e o `critique` com `node: "reflection"`
- [X] T022 [P] [US3] Em `src/http/server.test.ts`: corpo só com `message` → `200` e `trace` com `override: false` (o fake devolve `react`, não é default do Zod); `strategy: "plan-and-execute"` → `200`, `override: true`, `routeModel` não chamado; `strategy: "missing"` → `422` `{ error: { code: "UNKNOWN_STRATEGY" } }` e nenhum `run`; `strategy: ""` → `400` com `issues`

### Implementation for User Story 3

- [X] T023 [US3] Em `src/agents/production-graph.ts`: se `input.strategy` estiver definido, o nó `roteador` não chama `routeModel` e grava `override: true` com `OVERRIDE_REASON`. Com `reflect: true` e sem strategy, o enum aceito é só `react` | `plan-and-execute`. Com `reflect: true` e rota `react` ou `plan-and-execute`, executar `withReflection(strategy, undefined, deps.critic)`. Rota `reflection` usa `deps.strategies.reflection` (produção = `withReflection(reactStrategy)`)
- [X] T024 [US3] Em `src/http/server.ts`: `strategy` em `chatRequestSchema` passa a `z.string().trim().min(1).optional()` sem `.default("react")`. Se vier e não estiver em `PRODUCTION_ROUTES`, responder `422` `UNKNOWN_STRATEGY` e não chamar `runChat`. Tirar `registry.resolve` do `POST /chat`. `createChatServer` aceita `strategies` e `routeModel` (default de produção) e repassa `strategy` + `reflect` ao `runChat`. Atualizar os casos antigos de `src/http/server.test.ts` que assertavam `registry.calls` com `react` / `custom` ([contracts/chat-http.md](contracts/chat-http.md))

**Checkpoint**: US3 — override visível no trace; omitir `strategy` não força ReAct; nome desconhecido não entra no grafo

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quickstart, typecheck e aderência à constituição.

- [X] T025 [P] Rodar `npm run test -- src/agents/production-graph.test.ts src/agents/trace.test.ts` e corrigir falhas desta feature
- [X] T026 [P] Rodar `npm run test -- src/services/run-chat.test.ts src/http/server.test.ts` e confirmar que seguem sem rede e sem criar `./data/opspilot.db`
- [X] T027 Executar `npm run typecheck` e `npm run test` até verdes; percorrer os quatro cenários de [quickstart.md](quickstart.md)
- [X] T028 [P] Revisar aderência a `.specify/memory/constitution.md`: `buildContext` só no nó `contexto`; IO só em `runChat`; Zod na fronteira; `ModelOutputError` sem fallback; arena continua fora do grafo

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências
- **Foundational (Phase 2)**: Depende do Setup — **bloqueia** todas as histórias
- **US1 (Phase 3)**: Após Foundational — MVP
- **US2 (Phase 4)**: Após US1 (mesmo `production-graph.ts`)
- **US3 (Phase 5)**: Após US2 (override e HTTP assentam no evento `route` e no grafo)
- **Polish (Phase 6)**: Após as histórias desejadas

### User Story Dependencies

- **US1 (P1)**: Foundation → grafo com quatro visitas e contexto orçado. Sem HTTP.
- **US2 (P1)**: Depende do grafo da US1. Acrescenta prompt, evento `route`, `node` e erro de saída.
- **US3 (P2)**: Depende do evento `route` (US2) e de `runChat` (US1). HTTP não reintroduce registry.

### Within Each User Story

- Testes primeiro (devem falhar) → implementação → checkpoint

### Parallel Opportunities

- T002 e T003 em paralelo com T001 (arquivos distintos), desde que T003 só importe os exports de T001 ao compilar
- T005 e T006 em paralelo com T004
- T007, T008 e T009 em paralelo
- T012–T016 em paralelo
- T020, T021 e T022 em paralelo
- T025 e T026 em paralelo

---

## Parallel Example: User Story 2

```bash
# Testes do roteador em paralelo (mesmo arquivo — sequenciar se o runner conflitar):
Task: "T012 tabela no prompt em src/agents/production-graph.test.ts"
Task: "T013 evento route e node em src/agents/production-graph.test.ts"
Task: "T014 ModelOutputError em src/agents/production-graph.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup
2. Phase 2 Foundational
3. Phase 3 US1 (grafo + `runChat`)
4. **STOP**: `visited` na ordem e uma estratégia só, com contexto orçado
5. Seguir US2 (trace) → US3 (override HTTP) → Polish

### Incremental Delivery

1. Setup + Foundational → tipos e formatação do `route`
2. US1 → turn único no grafo (MVP)
3. US2 → decisão e `node` observáveis
4. US3 → cliente força a estratégia sem chamar o roteador
5. Polish → typecheck e suíte verdes

### Parallel Team Strategy

Com mais de uma pessoa:

1. Juntas: Setup + Foundational
2. Depois: US1 sozinha (o arquivo do grafo é compartilhado)
3. US2 e, em seguida, US3 no mesmo arquivo — não em paralelo
4. T022 (HTTP) pode ser escrito enquanto T020/T021 fecham o grafo, e integrado em T024

---

## Notes

- [P] = arquivos distintos, sem dependência incompleta
- Testes desta feature não usam OpenRouter: `routeModel` e estratégias são fakes
- Arena/CLI não passam pelo grafo e não ganham evento `route`
- Commit ao fim de cada fase ou grupo lógico
