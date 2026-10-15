---

description: "Task list for model resilience / fallback chain"
---

# Tasks: Resiliência de modelo

**Input**: Design documents from `/specs/014-model-resilience/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, constitution

**Tests**: Spec exige suíte sem rede (FR-013 / US1 / US2 / US3): retry de 3 no primário, reserva só depois, evento `fallback`, `metrics.fallbacks`, `503` com `MODEL_UNAVAILABLE`. Ver [contracts/model-factory.md](contracts/model-factory.md), [contracts/chat-http.md](contracts/chat-http.md) e [quickstart.md](quickstart.md).

**Organization**: Por história. Contratos: [contracts/model-factory.md](contracts/model-factory.md), [contracts/chat-http.md](contracts/chat-http.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos distintos, sem dependência incompleta)
- **[Story]**: US1 / US2 / US3
- Incluir caminhos de arquivo exatos

## Path Conventions

- Projeto único: `src/` na raiz, testes `src/**/*.test.ts` (`node:test` + `tsx`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Documentar a reserva no exemplo de ambiente, sem segredo.

- [X] T001 Adicionar `OPENROUTER_MODEL_FALLBACK=` (vazio) em `.env.example`. Não ler nem versionar `.env`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Erro de domínio e leitura da reserva. Bloqueia as três histórias.

**⚠️ CRITICAL**: Nenhuma história começa antes desta fase

- [X] T002 Criar `ModelUnavailableError` em `src/errors.ts` estendendo `DomainError`, com `code` `MODEL_UNAVAILABLE` e mensagem fixa legível, sem stack nem texto do provedor ([data-model.md](data-model.md))
- [X] T003 [P] Em `src/agents/model.ts`, exportar `readModelFallback(env)`: `OPENROUTER_MODEL_FALLBACK` ausente, `""` ou só espaços → `undefined`; caso contrário o trim. Não mudar ainda o retorno de `createModel()`

**Checkpoint**: `ModelUnavailableError` e `readModelFallback` existem; `createModel()` ainda devolve o `ChatOpenAI` cru

---

## Phase 3: User Story 1 - Plantão segue quando o modelo primário falha (Priority: P1) 🎯 MVP

**Goal**: Cada uso do modelo tenta o primário 3 vezes e, se houver reserva, chama-a uma vez. Primário que se recupera não chama a reserva. Cadeia esgotada lança `ModelUnavailableError`.

**Independent Test**: `npm run test -- src/agents/model.test.ts` com `RunnableLambda` fakes, sem rede. Reserva não roda nas tentativas 1 e 2. Três falhas sem reserva, ou reserva também falhando, lançam `ModelUnavailableError`.

### Tests for User Story 1

> Escrever primeiro; devem falhar até `createResilientRunnable` existir.

- [X] T004 [US1] Em `src/agents/model.test.ts`: primário falha 2 vezes e sucede na 3ª → sucesso; o runnable da reserva não é invocado
- [X] T005 [US1] Em `src/agents/model.test.ts`: primário falha 3 vezes e a reserva sucede → sucesso da reserva; a reserva não é chamada antes da 3ª falha
- [X] T006 [US1] Em `src/agents/model.test.ts`: primário e reserva falham → `ModelUnavailableError` (não a exceção crua); sem reserva, 3 falhas do primário → o mesmo erro e a reserva não é construída
- [X] T007 [US1] Em `src/agents/model.test.ts`: `readModelFallback` com env ausente, `""` e `"  "` → `undefined`; valor com espaços nas bordas → trim

### Implementation for User Story 1

- [X] T008 [US1] Em `src/agents/model.ts`, implementar `createResilientRunnable`: `primary.withRetry({ stopAfterAttempt: 3 })`; se houver reserva, `withFallbacks([reserva])` sem `withRetry` na reserva; qualquer falha da cadeia vira `ModelUnavailableError`. Callback opcional `onFallback` só depois da reserva responder ([contracts/model-factory.md](contracts/model-factory.md), research R1–R3)
- [X] T009 [US1] Em `src/agents/model.ts`, trocar `createModel()` por uma fachada com `invoke`, `bindTools` e `withStructuredOutput`. Cada método aplica a config no `ChatOpenAI` do primário e, se `readModelFallback` tiver valor, no da reserva, e então chama `createResilientRunnable`. Mesma `OPENROUTER_API_KEY`, base URL `https://openrouter.ai/api/v1`, `temperature: 0`. Chave ou `OPENROUTER_MODEL` ausentes continuam `ConfigError`
- [X] T010 [US1] Manter `createModel()` nos call sites `src/agents/react.ts`, `src/agents/plan-and-execute.ts`, `src/agents/reflection.ts`, `src/graph/production-Graph.ts`, `src/services/history-summarizer.ts` e `src/services/learning-reflector.ts`. Ajustar só o tipo/cast exigido pelo agente pré-construído ou por `withStructuredOutput`; não criar um segundo cliente sem retry

**Checkpoint**: US1 — cadeia fake verde; produção passa pela fachada

---

## Phase 4: User Story 2 - Saber que a reserva assumiu (Priority: P2)

**Goal**: Turn `200` traz eventos `fallback` (`from` / `to`) no fim do trace, na ordem em que a reserva atendeu, e `metrics.fallbacks` igual a essa quantidade. Primário que bastou deixa `0` e nenhum evento.

**Independent Test**: `npm run test -- src/agents/trace.test.ts src/services/run-chat.test.ts`. Sem rede. N eventos registrados no coletor → N eventos no trace e `metrics.fallbacks === N`. Coletor vazio → `0` e sem evento.

### Tests for User Story 2

- [X] T011 [P] [US2] Em `src/agents/trace.test.ts`: `formatTrace` imprime o evento `fallback` com `from` e `to` sem ler `content`; `summarizeMetrics` inclui `fallbacks=<n>` quando o campo existe
- [X] T012 [P] [US2] Em `src/services/run-chat.test.ts`: turn `200` sem registro de reserva → `metrics.fallbacks === 0` e o trace não contém `type: "fallback"`
- [X] T013 [US2] Em `src/services/run-chat.test.ts`: coletor com N registros durante sumarizador/grafo → os N eventos `fallback` ficam no fim do trace, em ordem, e `metrics.fallbacks === N`

### Implementation for User Story 2

- [X] T014 [US2] Em `src/agents/types.ts`, acrescentar `TraceEvent` `{ type: "fallback"; from: string; to: string; node?: string }` e `Metrics.fallbacks?: number` ([data-model.md](data-model.md))
- [X] T015 [P] [US2] Em `src/agents/trace.ts`, ramo `fallback` em `formatTrace` e `fallbacks=` em `summarizeMetrics` quando o campo está definido
- [X] T016 [P] [US2] Em `src/agents/model.ts`, coletor `AsyncLocalStorage`: a reserva bem-sucedida grava `{ type: "fallback", from: OPENROUTER_MODEL, to: OPENROUTER_MODEL_FALLBACK }`. Coletor já aberto não é substituído por um interno. Exportar helper para abrir o coletor e ler os eventos
- [X] T017 [US2] Em `src/services/run-chat.ts`, abrir o coletor antes do sumarizador e do grafo e fechá-lo antes de `scheduleLearningRemember`. No retorno `200`, anexar os eventos ao final de `trace` e setar `metrics.fallbacks` com o tamanho da lista. Aprendizado (009) fica fora: falha lá não entra na métrica nem no trace ([contracts/chat-http.md](contracts/chat-http.md))
- [X] T018 [US2] Em `src/agents/react.ts`, `src/agents/plan-and-execute.ts` e `src/agents/reflection.ts`, se não houver coletor ativo, abrir um e juntar os eventos ao `trace` e a `metrics.fallbacks` do `StrategyResult`. Se `runChat` já abriu, não abrir outro

**Checkpoint**: US2 — trace e métrica batem com a reserva que respondeu; aprendizado não conta

---

## Phase 5: User Story 3 - Indisponibilidade explícita quando nada responde (Priority: P3)

**Goal**: Cadeia esgotada no turn vira `503` com `MODEL_UNAVAILABLE`. Timeout continua `504`. O roteador não embrulha esse erro em `ModelOutputError`. Arena/CLI falha sem imprimir resposta.

**Independent Test**: `npm run test -- src/http/server.test.ts src/graph/production-Graph.test.ts`. Sem rede. Erro injetado → `503` e corpo `{ error: { code: "MODEL_UNAVAILABLE", message } }` sem `metrics`. `ChatTimeoutError` segue `504`.

### Tests for User Story 3

- [X] T019 [P] [US3] Em `src/http/server.test.ts`: grafo/estratégia que lança `ModelUnavailableError` → status `503`, `error.code` `MODEL_UNAVAILABLE`, mensagem sem stack, sem `answer`/`trace`/`metrics`. O teste existente de timeout continua `504`
- [X] T020 [P] [US3] Em `src/graph/production-Graph.test.ts`: `routeModel` que lança `ModelUnavailableError` → a mesma classe sobe; não vira `ModelOutputError` e o modelo não é chamado de novo

### Implementation for User Story 3

- [X] T021 [P] [US3] Em `src/http/server.ts`, mapear `ModelUnavailableError` para `503` com `{ error: { code: error.code, message: error.message } }`, no mesmo formato do `504` (sem prefixo `[CODE]`). Não usar `500` / `INTERNAL_ERROR`
- [X] T022 [P] [US3] Em `src/graph/production-Graph.ts` (`invokeDefaultRouteModel`), repropagar `ModelUnavailableError` na hora, sem o laço extra e sem `ModelOutputError`
- [X] T023 [US3] Em `src/arena.ts`, confirmar que `ModelUnavailableError` cai em `toBoundaryMessage` / `fail()` e não imprime `Answer:`. Só alterar o arquivo se o catch atual deixar a falha passar como sucesso

**Checkpoint**: US3 — indisponibilidade é `503`; timeout e erro de configuração não mudam

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Suíte inteira e quickstart.

- [X] T024 [P] Rodar `npm run test -- src/agents/model.test.ts src/agents/trace.test.ts src/services/run-chat.test.ts src/http/server.test.ts src/graph/production-Graph.test.ts` e corrigir regressões desses arquivos
- [X] T025 Executar `npm run typecheck` e `npm run test` até verdes; conferir os seis itens de [quickstart.md](quickstart.md)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências
- **Foundational (Phase 2)**: Pode seguir em paralelo com T001 (arquivos distintos) — **bloqueia** as histórias
- **US1 (Phase 3)**: Após Foundational — MVP
- **US2 (Phase 4)**: Após US1 (`createResilientRunnable` / fachada). Trace e coletor não existem antes
- **US3 (Phase 5)**: Após Foundational para o `503` com erro injetado; o rethrow do roteador só evita `500` de verdade depois que a fachada da US1 lança `ModelUnavailableError`
- **Polish (Phase 6)**: Após as histórias desejadas

### User Story Dependencies

- **US1 (P1)**: Foundation → cadeia fake + fachada no lugar de `createModel()`
- **US2 (P2)**: Depende da cadeia da US1 para registrar a reserva; o teste de `runChat` usa o coletor, não OpenRouter
- **US3 (P3)**: O mapeamento HTTP e o teste do roteador dependem só de `ModelUnavailableError`. A prova ponta a ponta (cadeia esgotada → `503`) depende da US1

### Within Each User Story

- Testes primeiro (devem falhar) → implementação → checkpoint
- T004–T007 no mesmo arquivo: em sequência
- T012 e T013 no mesmo `run-chat.test.ts`: T013 depois de T012
- T015 e T016 só depois de T014
- T017 depois de T016; T018 depois de T016

### Parallel Opportunities

- T001 (`.env.example`) e T002/T003 (arquivos de código distintos)
- T002 e T003 (arquivos distintos)
- T011 (`trace.test.ts`) e T012 (`run-chat.test.ts`)
- T015 (`trace.ts`) e T016 (`model.ts`) depois de T014
- T019 (`server.test.ts`) e T020 (`production-Graph.test.ts`)
- T021 (`server.ts`) e T022 (`production-Graph.ts`)
- T024 em paralelo com a leitura do quickstart, antes de T025 fechar a suíte

---

## Parallel Example: User Story 3

```bash
# Testes em arquivos distintos:
Task: "T019 503 em src/http/server.test.ts"
Task: "T020 rethrow em src/graph/production-Graph.test.ts"

# Implementação em arquivos distintos, depois dos testes:
Task: "T021 status 503 em src/http/server.ts"
Task: "T022 rethrow em src/graph/production-Graph.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup
2. Phase 2 Foundational
3. Phase 3 US1 (cadeia fake + fachada)
4. **STOP**: `src/agents/model.test.ts` verde — primário recupera sem reserva; reserva só na 3ª falha; esgotamento lança `ModelUnavailableError`
5. Seguir US2 (trace/métrica) → US3 (`503`) → Polish

### Incremental Delivery

1. Setup + Foundational → erro de domínio e env da reserva
2. US1 → retry e fallback na fábrica (MVP)
3. US2 → evento `fallback` e `metrics.fallbacks` no turn
4. US3 → `503` no HTTP e rethrow no roteador
5. Polish → `npm run typecheck` e `npm run test` verdes

### Parallel Team Strategy

1. Juntos: Setup + Foundational
2. Dev A: US1 em `src/agents/model.ts` (bloqueia US2)
3. Depois da US1: Dev B no coletor/`run-chat` (US2), Dev C no `503`/roteador (US3)

---

## Notes

- [P] = arquivos distintos, sem dependência incompleta
- `stopAfterAttempt: 3` explícito; reserva sem retry
- `llmCalls` não muda: cada `handleLLMStart` conta, inclusive tentativa que falhou
- Saída rejeitada depois do `invoke` (rota inválida, sumário vazio) não é `503`
- `ConfigError` de chave ou `OPENROUTER_MODEL` ausentes não vira `503`
- Commit após cada tarefa ou grupo lógico; marcar `[x]` em `tasks.md` na implementação
