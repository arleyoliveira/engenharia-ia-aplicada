---

description: "Task list for learning reflector / forget_preference"
---

# Tasks: Refletor de aprendizado

**Input**: Design documents from `/specs/009-learning-reflector/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, constitution; feature `008-semantic-memory` implementada

**Tests**: Spec exige testes (FR-008): preferência → remember; pontual/segredo → sem remember; forget_preference; não-bloqueio do async.

**Organization**: Por história. Contratos: [contracts/learning-reflector.md](contracts/learning-reflector.md), [contracts/forget-preference-tool.md](contracts/forget-preference-tool.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo
- **[Story]**: US1 / US2 / US3
- Incluir caminhos de arquivo exatos

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Módulo do refletor + schema Zod + prompt.

- [X] T001 Criar `src/services/learning-reflector.ts` com `learningReflectionSchema` (`hasLearning`, `fact`), tipo `LearningReflection` e constante `LEARNING_REFLECTOR_PROMPT` (nunca pontual / nunca segredo)
- [X] T002 [P] Definir `LearningReflectorDeps` (`distill?`, `schedule?`) e defaults documentados em JSDoc em `src/services/learning-reflector.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Destilação injetável + pós-filtro + scheduler — bloqueia histórias.

**⚠️ CRITICAL**: Nenhuma história começa antes desta fase

- [X] T003 Implementar `distillLearning(userMessage, deps?)` em `src/services/learning-reflector.ts` (default: `createModel().withStructuredOutput(schema, { method: "functionCalling" })`; deps.distill para fake)
- [X] T004 [P] Implementar pós-filtro puro `shouldRemember(reflection, userMessage): boolean` em `src/services/learning-reflector.ts` (hasLearning, fact trim, heurística de segredo)
- [X] T005 Implementar `scheduleLearningRemember({ userId, userMessage }, memory, deps?)` em `src/services/learning-reflector.ts` (filtra → `schedule(() => memory.remember(...))`; default schedule = fire-and-forget com catch silencioso/log)

**Checkpoint**: Foundation pronta — refletor testável sem `runChat`

---

## Phase 3: User Story 1 - Destilar preferências após o turn (Priority: P1) 🎯 MVP

**Goal**: Após sucesso de `runChat` com `userId` + `memory`, agendar `remember` sem bloquear o retorno.

**Independent Test**: Fake distill + MemoryStore fake + deferred remember → `runChat` resolve antes do settle; preferência agenda remember; sem `userId` não agenda.

### Tests for User Story 1

- [X] T006 [P] [US1] Em `src/services/learning-reflector.test.ts`, preferência (`hasLearning=true` + fact) passa no filtro; pontual (`hasLearning=false`) não
- [X] T007 [P] [US1] Em `src/services/run-chat.test.ts`, com distill fake de preferência + `userId` + memory: `remember` chamado; sem `userId`: não chamado
- [X] T008 [P] [US1] Em `src/services/run-chat.test.ts`, deferred `remember`: `runChat` retorna **antes** do resolve do remember (não-bloqueio)

### Implementation for User Story 1

- [X] T009 [US1] Estender `RunChatDeps` em `src/services/run-chat.ts` com `learning?: LearningReflectorDeps` (opcional)
- [X] T010 [US1] Após sucesso (strategy + append assistant), chamar `scheduleLearningRemember` sem await quando `userId` e `memory` presentes em `src/services/run-chat.ts`

**Checkpoint**: US1 — aprendizado async pós-turn

---

## Phase 4: User Story 2 - Recusar segredos e pontuais (Priority: P2)

**Goal**: Pós-filtro + comportamento do distill garantem zero persistência para segredo/pontual; falha do refletor não quebra o turn.

**Independent Test**: Segredo / fact vazio → sem remember; distill que rejeita → `runChat` ainda retorna ok.

### Tests for User Story 2

- [X] T011 [P] [US2] Em `src/services/learning-reflector.test.ts`, heurística rejeita fact/mensagem com padrões de segredo (`sk-`, `password`, `api_key`, etc.)
- [X] T012 [P] [US2] Em `src/services/learning-reflector.test.ts`, `hasLearning=true` + fact vazio → não agenda remember
- [X] T013 [P] [US2] Em `src/services/run-chat.test.ts`, distill que lança erro: `runChat` ainda devolve answer; remember não chamado (ou falha engolida no schedule)

### Implementation for User Story 2

- [X] T014 [US2] Completar/ajustar heurística e tratamento de erro em `src/services/learning-reflector.ts` até T011–T013 passarem

**Checkpoint**: US2 — segurança e best-effort

---

## Phase 5: User Story 3 - Tool `forget_preference` (Priority: P3)

**Goal**: Tool recall→forget no escopo do `userId`; injetada no `strategy.run` junto com ops tools.

**Independent Test**: `npm run test -- src/agents/memory-tools.test.ts`; wiring em `runChat` passa tools quando há `userId`+memory.

### Tests for User Story 3

- [X] T015 [P] [US3] Em `src/agents/memory-tools.test.ts`, seed + `forget_preference` → `{ forgotten: true }`; inexistente → `{ forgotten: false, reason: "not_found" }`
- [X] T016 [P] [US3] Em `src/services/run-chat.test.ts`, com `userId`+memory: `strategy.run` recebe `options.tools` contendo tool nomeada `forget_preference`

### Implementation for User Story 3

- [X] T017 [US3] Implementar `createForgetPreferenceTool({ memory, userId })` em `src/agents/memory-tools.ts` (schema Zod `preference`, recall top-1, forget, JSON result / `failurePayload`)
- [X] T018 [US3] Em `src/services/run-chat.ts`, quando `userId`+`memory`: montar tools = ops defaults (ou `deps.baseTools`) + forget; passar `strategy.run(input, { tools })`
- [X] T019 [US3] Confirmar que `src/agents/react.ts` e `src/agents/plan-and-execute.ts` usam `options?.tools` quando fornecidos (ajustar só se necessário)

**Checkpoint**: US3 — esquecimento via tool

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validação quickstart.

- [X] T020 [P] Atualizar JSDoc de `runChat` em `src/services/run-chat.ts` documentando aprendizado async + tools de memória
- [X] T021 Rodar [quickstart.md](quickstart.md): `npm run typecheck` e `npm run test`; corrigir regressões

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências
- **Foundational (Phase 2)**: Depende do Setup — **BLOQUEIA** histórias
- **US1 (Phase 3)**: Após Foundational — MVP
- **US2 (Phase 4)**: Após Foundational (idealmente após US1; compartilham `learning-reflector.ts`)
- **US3 (Phase 5)**: Após Foundational; wiring em `runChat` pode seguir US1
- **Polish (Phase 6)**: Após histórias desejadas

### User Story Dependencies

- **US1**: Foundation + gancho `runChat`
- **US2**: Foundation (filtro/erros); reforça US1
- **US3**: Foundation + `MemoryStore`; paralelo a US2 se `runChat` já aceitar tools

### Parallel Opportunities

- T001 ∥ T002 (Setup)
- T003 ∥ T004 (Foundational; T005 após ambos)
- T006 ∥ T007 ∥ T008 (testes US1)
- T011 ∥ T012 ∥ T013 (testes US2)
- T015 ∥ T016 (testes US3)
- Após Foundation, US3 (memory-tools) pode avançar em paralelo a testes US1/US2 em arquivos distintos

---

## Parallel Example: User Story 1

```bash
Task: "T006 learning-reflector.test.ts preferência vs pontual"
Task: "T007 run-chat.test.ts remember com userId"
Task: "T008 run-chat.test.ts não-bloqueio deferred"
```

## Parallel Example: User Story 3

```bash
Task: "T015 memory-tools.test.ts"
Task: "T016 run-chat.test.ts options.tools contém forget_preference"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Setup + Foundational
2. US1 (gancho async + testes)
3. **STOP e VALIDAR** com `run-chat.test.ts` / `learning-reflector.test.ts`

### Incremental Delivery

1. Setup + Foundational
2. US1 → aprendizado async
3. US2 → segredos / best-effort
4. US3 → `forget_preference`
5. Polish → typecheck + suíte

---

## Notes

- Não alterar contrato HTTP além do já existente em 008
- Typos já normalizados: `hasLearning`, `remember`
- Produção: OpenRouter no distill default; testes sempre com `deps.distill` fake
- Próximo comando: `/speckit-implement`
