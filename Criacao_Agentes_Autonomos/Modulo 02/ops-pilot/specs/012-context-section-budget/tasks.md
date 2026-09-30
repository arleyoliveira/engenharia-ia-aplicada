---

description: "Task list for context section budget / ContextBuilder"
---

# Tasks: Orçamento de contexto por seção

**Input**: Design documents from `/specs/012-context-section-budget/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, constitution

**Tests**: Spec exige testes sem rede (FR-011 / US2 / US3): system+message intocáveis; janela corta mais antigas; memórias cortam menor score; resumo ≤ teto; defaults 200/1200/300; env baixo sobrescreve. Ver [contracts/context-builder.md](contracts/context-builder.md) e [quickstart.md](quickstart.md).

**Organization**: Por história. Contratos: [contracts/context-builder.md](contracts/context-builder.md), [contracts/chat-http.md](contracts/chat-http.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos distintos, sem dependência incompleta)
- **[Story]**: US1 / US2 / US3
- Incluir caminhos de arquivo exatos

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Tipos, constantes e esqueleto do módulo pedido.

- [X] T001 Criar `src/context/context-builder.ts` com exports tipados `SectionBudgets`, `ContextBuilderInput`, `BudgetedContext`, `MemoryCandidate` conforme [data-model.md](data-model.md)
- [X] T002 [P] Em `src/context/context-builder.ts`: exportar `DEFAULT_SECTION_BUDGETS = { summary: 200, window: 1200, memories: 300 }`
- [X] T003 [P] Criar esqueleto `src/context/context-builder.test.ts` (`node:test` + `tsx`) importando o módulo (pode falhar até a implementação)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Resolução de tetos + API `buildBudgetedContext` (passthrough mínimo) — bloqueia wiring e histórias.

**⚠️ CRITICAL**: Nenhuma história começa antes desta fase

- [X] T004 Em `src/context/context-builder.ts`: implementar `resolveSectionBudgets(env?)` lendo `CONTEXT_BUDGET_SUMMARY` / `CONTEXT_BUDGET_WINDOW` / `CONTEXT_BUDGET_MEMORIES`; inválido (`≤0`, não numérico, vazio) → padrão; sem dotenv ([contracts/context-builder.md](contracts/context-builder.md))
- [X] T005 Em `src/context/context-builder.ts`: implementar `buildBudgetedContext(input, budgets)` **passthrough** — `system`/`message` idênticos; `summary`/`history`/`memories` copiados sem corte ainda (memories: mapear `fact` → `string[]`); seções vazias ausentes/`[]`
- [X] T006 Exportar helpers internos ou funções nomeadas previstas no plano (`trimSummaryToBudget`, `trimWindowOldestFirst`, `trimMemoriesLowestScoreFirst`) como stubs que ainda não cortam (ou deixar private e completar em US2) — API pública estável: `buildBudgetedContext` + `resolveSectionBudgets` + `DEFAULT_SECTION_BUDGETS`

**Checkpoint**: Foundation pronta — tipos + defaults + resolve + build testáveis sem `runChat`

---

## Phase 3: User Story 1 - Montar o contexto com teto por seção (Priority: P1) 🎯 MVP

**Goal**: `runChat` orça via ContextBuilder antes de qualquer strategy; system/message intocáveis; todas as estratégias recebem só material do builder; métricas refletem o orçado (mesmo sem corte forçado).

**Independent Test**: Entradas sob os tetos padrão → strategy/`lastInput` com history/summary/memories intactos; system+message presentes; `contextBreakdown` / `historyMessages` / `recalledMemories` batem com o orçado. Sem rede.

### Tests for User Story 1

> Escrever primeiro; devem falhar até o wiring em `runChat`.

- [X] T007 [P] [US1] Em `src/context/context-builder.test.ts`: sob defaults, input sob teto → output preserva `system`, `message`, `summary`, `history`, `memories` (fatos); system/message nunca alterados
- [X] T008 [P] [US1] Em `src/services/run-chat.test.ts`: com strategy fake, recall seed + history + summary sob teto → `lastInput` espelha o budgeted; `metrics.historyMessages` / `recalledMemories` / `contextBreakdown` coerentes com o input passado à strategy (não com bruto diferente)
- [X] T009 [P] [US1] Em `src/services/run-chat.test.ts` (ou assert via fake): confirmar que `strategy.run` recebe o objeto já orçado (único caminho — sem segundo assemble paralelo)

### Implementation for User Story 1

- [X] T010 [US1] Em `src/services/run-chat.ts`: após `lastMessages` / summary / recall, chamar `resolveSectionBudgets(process.env)` + `buildBudgetedContext({ message, summary, history, memories: hits com score })`; passar ao `strategy.run` apenas `message` / `history` / `memories` / `summary` do `BudgetedContext`
- [X] T011 [US1] Em `src/services/run-chat.ts`: calcular `historyMessages`, `recalledMemories` e `estimateContextBreakdown` **somente** com o material orçado ([contracts/chat-http.md](contracts/chat-http.md))
- [X] T012 [US1] Em `src/services/run-chat.ts`: manter recall como `RecallHit[]` (não descartar `score` antes do builder); mapear só `fact` depois do corte para a strategy

**Checkpoint**: US1 — todas as strategies veem contexto montado pelo builder; métricas pós-orçamento

---

## Phase 4: User Story 2 - Cortar na ordem certa quando o teto estoura (Priority: P2)

**Goal**: Políticas de corte determinísticas: janela (mais antigas), memórias (menor score / empate = pior ranking), resumo (prefixo até caber); system/message intactos sob tetos baixos.

**Independent Test**: `npm run test -- src/context/context-builder.test.ts` com tetos baixos explícitos — ordem de sobreviventes assertada. Sem rede.

### Tests for User Story 2

- [X] T013 [P] [US2] Em `src/context/context-builder.test.ts`: histórico `[old, mid, new]` com `window` que só cabe `new` → `history === [new]`; system/message intactos
- [X] T014 [P] [US2] Em `src/context/context-builder.test.ts`: 3 memórias scores distintos, teto apertado → sobrevivem as de maior score; empate de score remove o de pior ranking (último entre empatados)
- [X] T015 [P] [US2] Em `src/context/context-builder.test.ts`: resumo longo → `estimateTokens(summary) ≤ budgets.summary`; mensagem/system inalterados
- [X] T016 [P] [US2] Em `src/context/context-builder.test.ts`: mensagem ou fato individual `> teto` da seção → não entra; corte multi-seção independente (janela ≠ memórias ≠ resumo)
- [X] T017 [P] [US2] Em `src/services/run-chat.test.ts`: com budgets baixos injetáveis (param em deps **ou** stub de `resolveSectionBudgets` / budgets passados ao builder) → `lastInput.history` / `memories` / `summary` cortados e métricas batem com o cortado

### Implementation for User Story 2

- [X] T018 [US2] Em `src/context/context-builder.ts`: implementar `trimWindowOldestFirst` — enquanto soma `estimateTokens(content) > budget`, remover índice 0; item individual `> budget` não entra
- [X] T019 [US2] Em `src/context/context-builder.ts`: implementar `trimMemoriesLowestScoreFirst` — remover menor score (empate → pior ranking); item individual `> budget` não entra; saída `string[]` estável
- [X] T020 [US2] Em `src/context/context-builder.ts`: implementar `trimSummaryToBudget` — prefixo com `maxLen = 4 * budget + 3`, ajustar até `estimateTokens ≤ budget`; vazio → omitir
- [X] T021 [US2] Em `src/context/context-builder.ts`: `buildBudgetedContext` aplica os três trims; system/message nunca passam pelos trims
- [X] T022 [US2] Em `src/services/run-chat.ts` (se necessário): permitir injetar `SectionBudgets` via deps de teste **sem** dotenv, mantendo produção com `resolveSectionBudgets(process.env)`

**Checkpoint**: US2 — tetos baixos cortam na ordem certa; métricas pós-corte no chat

---

## Phase 5: User Story 3 - Configurar tetos por ambiente sem rede (Priority: P3)

**Goal**: `CONTEXT_BUDGET_*` configura tetos; ausente/inválido → 200/1200/300; suíte cobre defaults + override sem rede.

**Independent Test**: Testes de `resolveSectionBudgets` + quickstart cenário 1 verdes sem OpenRouter.

### Tests for User Story 3

- [X] T023 [P] [US3] Em `src/context/context-builder.test.ts`: `resolveSectionBudgets({})` === `{ summary: 200, window: 1200, memories: 300 }`
- [X] T024 [P] [US3] Em `src/context/context-builder.test.ts`: env com valores baixos válidos → budgets iguais aos parseados; `"0"`, `"abc"`, `""`, negativos → default da seção
- [X] T025 [P] [US3] Em `src/http/server.test.ts`: regressão 007/008/010/011 — códigos de erro e campos de métricas existentes; sem exigir campos novos no body ([contracts/chat-http.md](contracts/chat-http.md))

### Implementation for User Story 3

- [X] T026 [US3] Revisar `resolveSectionBudgets` em `src/context/context-builder.ts` contra [contracts/context-builder.md](contracts/context-builder.md) (trim, `Number.parseInt`/`Number`, finito, `> 0`)
- [X] T027 [US3] Garantir que produção em `src/services/run-chat.ts` usa env do processo e que testes HTTP/fake não dependem de mutar `process.env` global (preferir budgets injetados da US2)

**Checkpoint**: US3 — operabilidade via env + suíte sem rede

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validação final e aderência ao quickstart.

- [X] T028 [P] Rodar `npm run test -- src/context/context-builder.test.ts src/services/run-chat.test.ts` e corrigir regressões de pruning/memórias
- [X] T029 [P] Rodar `npm run test -- src/http/server.test.ts` e confirmar sem criação de `./data/opspilot.db` por estes testes
- [X] T030 Executar `npm run typecheck` e `npm run test` até verdes; validar checklist de [quickstart.md](quickstart.md) (cenários 1–4)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências
- **Foundational (Phase 2)**: Depende do Setup — **bloqueia** todas as histórias
- **US1 (Phase 3)**: Após Foundational — MVP
- **US2 (Phase 4)**: Após Foundational; na prática após US1 (mesmo `context-builder.ts` / `run-chat.ts`)
- **US3 (Phase 5)**: Após Foundational; testes de env podem rodar em paralelo com US2 se T004 já existe; wiring final após US2 se deps de budgets forem da US2
- **Polish (Phase 6)**: Após histórias desejadas

### User Story Dependencies

- **US1 (P1)**: Foundation → builder passthrough + `runChat` wiring
- **US2 (P2)**: Depende da API do builder (US1/Foundation); adiciona políticas de corte
- **US3 (P3)**: Depende de `resolveSectionBudgets` (T004); valida env + regressão HTTP

### Within Each User Story

- Testes primeiro (devem falhar) → implementação → checkpoint

### Parallel Opportunities

- T001–T003 (setup) parcialmente [P]
- T007–T009 (testes US1) em paralelo
- T013–T017 (testes US2) em paralelo após API estável
- T023–T025 (testes US3) em paralelo
- T028–T029 (polish) em paralelo

---

## Parallel Example: User Story 2

```bash
# Testes de corte em paralelo (mesmo arquivo de teste, casos distintos — sequenciar se o runner conflitar):
Task: "T013 window oldest-first em src/context/context-builder.test.ts"
Task: "T014 memories lowest-score em src/context/context-builder.test.ts"
Task: "T015 summary prefix em src/context/context-builder.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup
2. Phase 2 Foundational
3. Phase 3 US1 (`runChat` + builder passthrough)
4. **STOP**: validar que strategies só veem contexto do builder
5. Seguir US2 (cortes) → US3 (env) → Polish

### Incremental Delivery

1. Setup + Foundational → API do builder
2. US1 → montagem única para todas as strategies (MVP)
3. US2 → ordem de corte com tetos baixos
4. US3 → `CONTEXT_BUDGET_*` + regressão HTTP
5. Polish → typecheck/test/quickstart verdes

### Parallel Team Strategy

1. Juntos: Setup + Foundational
2. Dev A: US1 wiring `run-chat`
3. Dev B: políticas de corte + testes unitários (US2) no `context-builder`
4. Dev C: testes de env + HTTP regressão (US3)

---

## Notes

- [P] = arquivos/casos distintos sem dependência incompleta
- Unidade de teto = `estimateTokens` (`floor(chars/4)`) em `src/context/tokens.ts`
- Janela de **contagem** `HISTORY_WINDOW = 8` (011) continua **antes** do orçamento por tokens
- Não alterar contratos HTTP de erro; não cortar system/message
- Commit após cada tarefa ou grupo lógico; marcar `[x]` em `tasks.md` na implementação
