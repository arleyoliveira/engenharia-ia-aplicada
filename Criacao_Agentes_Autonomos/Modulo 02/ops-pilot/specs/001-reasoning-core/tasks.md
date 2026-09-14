---

description: "Task list for Núcleo de Raciocínio do OpsPilot"
---

# Tasks: Núcleo de Raciocínio do OpsPilot

**Input**: Design documents from `/specs/001-reasoning-core/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Incluídos — o spec exige testes determinísticos (FR-012) e a constituição exige teste para toda lógica nova.

**Organization**: Tarefas agrupadas por história de usuário para implementação e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências incompletas)
- **[Story]**: História à qual a tarefa pertence (US1, US2, US3)
- Caminhos de arquivo exatos em cada descrição

## Path Conventions

- Projeto único: `src/` na raiz do repositório (conforme plan.md)
- Testes colocados ao lado do código (`*.test.ts`), capturados pelo script `npm run test`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependências, configuração e esqueleto de pastas exigidos por todas as histórias

- [X] T001 Adicionar dependências `sequelize` e `mysql2` e remover stub obsoleto `@types/sequelize` em package.json (research R4)
- [X] T002 Adicionar script `seed` (`tsx src/scripts/seed.ts`) e atualizar scripts `dev`/`arena`/`bench` para `tsx --env-file-if-exists=.env` em package.json (research R6)
- [X] T003 Adicionar `DATABASE_URL=` ao arquivo .env.example
- [X] T004 [P] Criar classes de erro de domínio `ConfigError`, `NotFoundError`, `InvalidStateError`, `IterationLimitError` em src/errors.ts
- [X] T005 [P] Criar tipos puros `TraceEvent` (união discriminada: thought/action/observation/plan/critique/answer), `Metrics`, `StrategyResult` e interface `ReasoningStrategy` em src/agents/types.ts (contracts/trace.md)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Núcleo compartilhado — modelo LLM, store, ferramentas, formatação de trace — que TODAS as histórias consomem

**⚠️ CRITICAL**: Nenhuma história pode começar antes desta fase estar completa

- [X] T006 Escrever testes determinísticos do store em src/services/alert-store.test.ts: listar alertas com/sem filtro de status, abrir incidente em serviço existente, rejeitar serviço inexistente/severidade inválida (ValidationError), resolver incidente existente, idempotência ao resolver já resolvido, NotFoundError em id inexistente — usando fakes in-memory, sem rede/banco real (FR-006, FR-012)
- [X] T007 [P] Escrever testes determinísticos de formatação de trace em src/agents/trace.test.ts: serialização estável uma linha por evento, action inclui tool+args, trace termina com answer, métricas com campos llmCalls/latencyMs (FR-002, FR-003, FR-012)
- [X] T008 Criar conexão Sequelize via `DATABASE_URL` com falha `ConfigError` quando ausente em src/models/database.ts
- [X] T009 [P] Criar model Service (id, name único) em src/models/service.ts conforme data-model.md
- [X] T010 [P] Criar model Alert (id, serviceId FK, title, status firing|resolved) em src/models/alert.ts conforme data-model.md
- [X] T011 [P] Criar model Incident (id, serviceId FK, title, severity low|medium|high|critical, status open|resolved, resolvedAt) em src/models/incident.ts conforme data-model.md
- [X] T012 Implementar store (listAlerts com filtro, openIncident, resolveIncident idempotente) sobre os models com injeção para testes em src/services/alert-store.ts, fazendo T006 passar
- [X] T013 Implementar formatação pura e determinística de traces (`formatTrace`) em src/agents/trace.ts, fazendo T007 passar
- [X] T014 Implementar fábrica única `createModel()` (ChatOpenAI, baseURL https://openrouter.ai/api/v1, temperature 0, `ConfigError` se OPENROUTER_API_KEY/OPENROUTER_MODEL ausentes) em src/agents/model.ts (research R3)
- [X] T015 Implementar as 3 ferramentas LangChain (`tool()` + schemas Zod de contracts/tools.md) sobre o store: list_alerts, open_incident, resolve_incident em src/agents/tools.ts
- [X] T016 Implementar wrapper de métricas: contador `llmCalls` via callback `handleLLMStart` e `latencyMs` via `performance.now()` em src/agents/metrics.ts (research R5)

**Checkpoint**: Foundation pronta — `npm run typecheck` e `npm run test` (T006, T007) verdes; histórias podem começar em paralelo

---

## Phase 3: User Story 1 - Comparar estratégias de raciocínio na arena (Priority: P1) 🎯 MVP

**Goal**: Arena CLI executa 1+ estratégias sobre o mesmo input e imprime resposta, trace tipado e métricas por estratégia

**Independent Test**: `node --env-file=.env node_modules/.bin/tsx src/arena.ts --strategies react --max-iterations 4 "..."` imprime bloco `=== react ===` com resposta, trace e métricas (quickstart cenários 3–5)

### Implementation for User Story 1

- [X] T017 [P] [US1] Implementar estratégia ReAct com `createReactAgent` de @langchain/langgraph/prebuilt, convertendo mensagens em TraceEvents (thought/action/observation/answer), respeitando `recursionLimit` como maxIterations (mapeado para encerramento controlado com evento critique) e instrumentando métricas, em src/agents/react.ts (research R1, R7; FR-008, FR-010)
- [X] T018 [P] [US1] Implementar estratégia Plan-and-Execute como StateGraph (planner com saída estruturada `steps` máx. 8, executor de um passo por vez com tools, replanner com união discriminada respond/continue; roteador encerra quando não restam passos ou limite atingido) em src/agents/plan-and-execute.ts (research R2; FR-009, FR-010)
- [X] T019 [US1] Implementar registro de estratégias (`react`, `plan-and-execute`) e arena CLI: parseArgs + Zod nas flags `--strategies`/`--max-iterations`, validação de input, execução sequencial sobre o mesmo input, impressão de blocos nomeados com trace formatado e métricas, tradução de erros de domínio (exit 1) em src/arena.ts (contracts/cli.md; FR-001, FR-011, FR-013)

**Checkpoint**: Arena executável com as 2 estratégias; cenários 3, 4 e 5 do quickstart passam

---

## Phase 4: User Story 2 - Ferramentas operacionais sobre o catálogo de alertas (Priority: P2)

**Goal**: Catálogo semeado (5 serviços, 6 alertas) instalável por script independente e persistido em MySQL, sustentando as ferramentas já testadas em T006/T012

**Independent Test**: `node --env-file=.env node_modules/.bin/tsx src/scripts/seed.ts` imprime `5 services, 6 alerts (3 firing, 3 resolved)` e reexecução não duplica (quickstart cenário 1)

### Implementation for User Story 2

- [X] T020 [US2] Implementar script de seed idempotente (`findOrCreate` por chave natural: nome do serviço, título do alerta) com o catálogo de data-model.md e saída de contagem em src/scripts/seed.ts (FR-007)
- [X] T021 [US2] Executar o seed contra o MySQL local (`npm run seed`) e verificar contagens e idempotência conforme quickstart cenário 1

**Checkpoint**: Banco local populado; ferramentas operam sobre dados reais na arena

---

## Phase 5: User Story 3 - Observabilidade uniforme do raciocínio (Priority: P3)

**Goal**: Garantir que ambas as estratégias emitem trace e métricas no mesmo formato, com serialização estável e contagem exata de chamadas de LLM

**Independent Test**: Cenário 4 do quickstart mostra os mesmos campos de métricas nas 2 estratégias; testes T007 cobrem a formatação; inspeção manual confirma `llmCalls` igual ao número de chamadas observadas (SC-006)

### Implementation for User Story 3

- [X] T022 [P] [US3] Adicionar casos de teste de serialização estável do trace para eventos plan e critique (revisão do replanner, encerramento por limite) em src/agents/trace.test.ts (SC-002)
- [X] T023 [US3] Verificar paridade de formato entre estratégias: rodar cenário 4 do quickstart e confirmar eventos tipados válidos e métricas uniformes em ambos os blocos; ajustar src/agents/react.ts e src/agents/plan-and-execute.ts se necessário

**Checkpoint**: Comparabilidade total entre estratégias (SC-002, SC-006)

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validação integral e documentação final

- [X] T024 [P] Rodar todos os cenários do quickstart.md (1–6) e registrar evidências
- [X] T025 [P] Garantir `npm run typecheck` e `npm run test` verdes no estado final
- [X] T026 Revisar aderência à constituição: Zod em toda entrada externa, erros de domínio na borda, funções puras no domínio, nenhuma leitura de `.env` em código

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — começa imediatamente
- **Foundational (Phase 2)**: depende de T001–T005 — BLOQUEIA todas as histórias
- **User Story 1 (Phase 3)**: depende da Phase 2 — entrega o MVP (arena + estratégias)
- **User Story 2 (Phase 4)**: depende da Phase 2 — independente de US1; habilita dados reais para a arena
- **User Story 3 (Phase 5)**: depende de US1 (T017–T018) — valida paridade entre estratégias
- **Polish (Phase 6)**: depende de todas as histórias concluídas

### User Story Dependencies

- **US1 (P1)**: só Phase 2 — independente das demais
- **US2 (P2)**: só Phase 2 — independente; recomendado antes da demo com dados reais
- **US3 (P3)**: depende de US1 (precisa das 2 estratégias existirem para comparar)

### Within Each User Story

- Testes (quando presentes) antes da implementação (T006/T007 antes de T012/T013)
- Models antes de services antes da borda (CLI)
- Story completa antes de avançar para a próxima prioridade

### Parallel Opportunities

- Phase 1: T004 e T005 em paralelo (após T001–T003)
- Phase 2: T007 ∥ T006 (arquivos diferentes); T009 ∥ T010 ∥ T011 (models independentes)
- Phase 3: T017 ∥ T018 (estratégias em arquivos separados)
- Após Phase 2: US1 e US2 podem rodar em paralelo por desenvolvedores diferentes
- Phase 6: T024 ∥ T025

---

## Parallel Example: Foundational

```text
# Lançar juntos (arquivos distintos):
T007: testes de trace em src/agents/trace.test.ts
T009: model Service em src/models/service.ts
T010: model Alert em src/models/alert.ts
T011: model Incident em src/models/incident.ts
```

## Parallel Example: User Story 1

```text
# Lançar juntos:
T017: estratégia ReAct em src/agents/react.ts
T018: estratégia Plan-and-Execute em src/agents/plan-and-execute.ts
# Depois, sequencial:
T019: arena CLI em src/arena.ts (integra as duas)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup (T001–T005)
2. Completar Phase 2: Foundational (T006–T016) — CRÍTICO, bloqueia tudo
3. Completar Phase 3: User Story 1 (T017–T019)
4. **STOP and VALIDATE**: cenários 3–5 do quickstart
5. Demonstrável: arena comparando react sobre o catálogo

### Incremental Delivery

1. Setup + Foundational → fundação pronta
2. US1 → arena com 2 estratégias → **MVP demonstrável**
3. US2 → seed real no MySQL → dados de verdade na arena
4. US3 → paridade de observabilidade validada
5. Polish → release da feature

### Parallel Team Strategy

1. Time completa Setup + Foundational junto
2. Após Phase 2:
   - Dev A: US1 (react, plan-and-execute, arena)
   - Dev B: US2 (seed)
3. Dev A fecha US3; converge no Polish

---

## Notes

- [P] = arquivos diferentes, sem dependências incompletas
- [USn] mapeia a tarefa para a história (rastreabilidade)
- Cada história é independentemente completável e testável
- Testes rodam via `npm run test` (glob `src/**/*.test.ts`)
- Commit por tarefa ou grupo lógico; marcar `[X]` ao concluir
- Evitar: tarefas vagas, conflitos de arquivo, dependências cruzadas entre histórias
