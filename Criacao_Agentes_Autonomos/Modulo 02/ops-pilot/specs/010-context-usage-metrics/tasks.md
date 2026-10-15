---

description: "Task list for context usage metrics"
---

# Tasks: Medição de contexto do chat

**Input**: Design documents from `/specs/010-context-usage-metrics/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, constitution

**Tests**: Spec exige testes (FR-012): `estimateTokens` (vazio / &lt;4 / resto); `contextBreakdown` por fonte; `promptTokens` somado a partir de usage e `0` sem usage; presença dos dois campos no `200` do `/chat`. Sem rede.

**Organization**: Por história. Contratos: [contracts/context-metrics.md](contracts/context-metrics.md), [contracts/chat-http.md](contracts/chat-http.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos distintos, sem dependência incompleta)
- **[Story]**: US1 / US2 / US3
- Incluir caminhos de arquivo exatos

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Pasta `src/context/` + tipos de métrica.

- [X] T001 Criar diretório `src/context/` e esqueleto de `src/context/tokens.ts` (exports: `estimateTokens`, `estimateContextBreakdown`, `promptTokensFromLlmEnd`, tipo `ContextBreakdown`)
- [X] T002 [P] Estender `Metrics` em `src/agents/types.ts` com `promptTokens?: number` e `contextBreakdown?: { message: number; history: number; memories: number }`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Estimativa pura + parser de usage + contador — bloqueia as histórias.

**⚠️ CRITICAL**: Nenhuma história começa antes desta fase

- [X] T003 Implementar `estimateTokens(text)` = `Math.floor(text.length / 4)` em `src/context/tokens.ts`
- [X] T004 [P] Implementar `estimateContextBreakdown({ message, history, memories })` em `src/context/tokens.ts` (soma por `content` / fato; listas vazias → 0; sem rótulos)
- [X] T005 Implementar `promptTokensFromLlmEnd(output)` em `src/context/tokens.ts` conforme [data-model.md](data-model.md): prioridade `llmOutput.tokenUsage.promptTokens` → `usage_metadata.input_tokens` da 1ª generation → `response_metadata.tokenUsage.promptTokens`; ignorar `estimatedTokenUsage`; inválido → 0; **não** somar tokenUsage + usage_metadata da mesma chamada
- [X] T006 Estender `createLlmCallCounter()` em `src/agents/metrics.ts`: getter `promptTokens`; em `handleLLMEnd` somar `promptTokensFromLlmEnd`; `handleLLMStart` continua só incrementando `calls`

**Checkpoint**: Foundation pronta — estimativa e usage testáveis sem `runChat`

---

## Phase 3: User Story 1 - Ver o tamanho real do prompt (Priority: P1) 🎯 MVP

**Goal**: Estratégias reportam `metrics.promptTokens` (soma do usage de entrada do turno); `runChat` / `POST /chat` devolvem o inteiro (ou `0` sem usage).

**Independent Test**: Fake strategy com `promptTokens` conhecido → `runChat` / HTTP `200` com o mesmo valor; fake sem campo → `0`. Contador com dois `handleLLMEnd` soma. Sem rede.

### Tests for User Story 1

> Escrever primeiro; devem falhar antes da implementação das strategies/`runChat` merge.

- [X] T007 [P] [US1] Em `src/context/tokens.test.ts`, cobrir `promptTokensFromLlmEnd`: tokenUsage vence; não duplica com usage_metadata; ausência → 0; ignora `estimatedTokenUsage`; número inválido/negativo → 0
- [X] T008 [P] [US1] Em `src/agents/metrics.test.ts`, duas `handleLLMEnd` somam `promptTokens`; `handleLLMStart` não altera tokens; `calls` ainda incrementa
- [X] T009 [P] [US1] Em `src/services/run-chat.test.ts`, strategy fake **sem** `promptTokens` → `result.metrics.promptTokens === 0`; fake **com** `promptTokens: 42` → `42`
- [X] T010 [P] [US1] Em `src/http/server.test.ts`, `200` inclui `metrics.promptTokens` (inteiro ≥ 0; fake atual → `0`)
- [X] T011 [P] [US1] Em `src/agents/reflection.test.ts`, `withReflection` soma `promptTokens` das voltas da base; se o modelo crítico fake chamar `handleLLMEnd` com usage, esses tokens entram na soma

### Implementation for User Story 1

- [X] T012 [US1] Em `src/agents/react.ts`, preencher `metrics.promptTokens = counter.promptTokens` no retorno do `run`
- [X] T013 [P] [US1] Em `src/agents/plan-and-execute.ts`, preencher `metrics.promptTokens = counter.promptTokens` no retorno do `run`
- [X] T014 [US1] Em `src/agents/reflection.ts`, somar `(baseResult.metrics.promptTokens ?? 0)` a cada volta e acrescentar `counter.promptTokens` do crítico em todos os returns de métricas
- [X] T015 [US1] Em `src/services/run-chat.ts`, no merge de métricas: `promptTokens: result.metrics.promptTokens ?? 0` (junto com `historyMessages` / `recalledMemories`)
- [X] T016 [US1] Ajustar fake do crítico em `src/agents/reflection.test.ts` para chamar `handleLLMEnd` com fixture de usage quando o teste T011 exigir (além do `handleLLMStart` atual)

**Checkpoint**: US1 — `promptTokens` real (ou 0) no `200`

---

## Phase 4: User Story 2 - Ver de onde veio o contexto (Priority: P2)

**Goal**: `metrics.contextBreakdown` estimado por `message` / `history` / `memories` com `floor(chars/4)`, calculado em `runChat` a partir do contexto montado (não precisa igualar `promptTokens`).

**Independent Test**: Textos conhecidos → breakdown bate com `estimateTokens` por fonte; conversa nova sem histórico/memórias → `history` e `memories` = 0.

### Tests for User Story 2

- [X] T017 [P] [US2] Em `src/context/tokens.test.ts`, cobrir `estimateTokens`: `""` → 0; comprimento 1..3 → 0; resto não nulo (ex.: 5 → 1); e `estimateContextBreakdown` com três fontes + fontes vazias
- [X] T018 [P] [US2] Em `src/services/run-chat.test.ts`, mensagem + histórico + memórias conhecidos → `contextBreakdown` igual a `estimateContextBreakdown(...)`; sem histórico/memórias → `history: 0`, `memories: 0`, `message` só da mensagem atual
- [X] T019 [P] [US2] Em `src/http/server.test.ts`, `200` inclui `metrics.contextBreakdown` com as três chaves inteiras ≥ 0

### Implementation for User Story 2

- [X] T020 [US2] Em `src/services/run-chat.ts`, após a estratégia, calcular `contextBreakdown` via `estimateContextBreakdown` com `input.message`, o `history` carregado **antes** do append do user, e o array `memories` do recall; mergear nas métricas

**Checkpoint**: US2 — partição estimada no `200`

---

## Phase 5: User Story 3 - Plantão longo imprime promptTokens (Priority: P3)

**Goal**: `scripts/conversa-longa.sh` imprime, por turno, `.metrics.promptTokens` da resposta (fallback `n/a`).

**Independent Test**: Grep/leitura estática do script confirma `jq` em `.metrics.promptTokens // "n/a"` e `promptTokens=` na linha do turno. Ensaio ao vivo de 30 turnos **fora** da suíte.

### Tests for User Story 3

- [X] T021 [P] [US3] Em teste leve (ex.: `src/scripts/conversa-longa.test.ts` ou assert no próprio `tokens`/docs — preferir ler o arquivo via `node:fs` em `src/context/tokens.test.ts` **ou** arquivo dedicado `scripts/conversa-longa.test.ts` se o runner cobrir `scripts/`): confirmar que `scripts/conversa-longa.sh` contém a leitura `.metrics.promptTokens` e o fallback `n/a`. Se o `npm test` só cobre `src/**/*.test.ts`, colocar o assert em `src/context/conversa-longa-script.test.ts` lendo o path `scripts/conversa-longa.sh`.

### Implementation for User Story 3

- [X] T022 [US3] Conferir `scripts/conversa-longa.sh`: manter impressão por turno de `promptTokens` com fallback `n/a`; **não** mudar o formato da linha nem falhar o turno se o campo estiver ausente. Ajustar só se o script divergir do contrato [contracts/chat-http.md](contracts/chat-http.md)

**Checkpoint**: US3 — script alinhado ao contrato

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Observabilidade local + validação quickstart.

- [X] T023 [P] Em `src/agents/trace.ts`, incluir `promptTokens` em `summarizeMetrics` quando o campo estiver definido (mesmo padrão de `historyMessages`); cobrir em `src/agents/trace.test.ts`
- [X] T024 Rodar [quickstart.md](quickstart.md): `npm run typecheck` e `npm run test`; corrigir regressões (fakes de métricas incompletas, types em `StrategyResult`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências
- **Foundational (Phase 2)**: Depende do Setup — **bloqueia** todas as histórias
- **US1 (Phase 3)**: Após Foundational — MVP
- **US2 (Phase 4)**: Após Foundational; reusa `estimateContextBreakdown` (T004) e o merge de `runChat` (T015) — pode começar em paralelo à US1 se T015 for feito mínimo (`promptTokens`) e T020 acrescentar breakdown, ou sequencialmente após US1
- **US3 (Phase 5)**: Independente do código TypeScript das outras histórias; só precisa do contrato de resposta (US1) para o valor real aparecer ao vivo. O assert estático do script pode rodar após Setup
- **Polish (Phase 6)**: Após as histórias desejadas

### User Story Dependencies

- **US1 (P1)**: Depende de T005–T006 (parser + contador). Sem dependência de US2/US3
- **US2 (P2)**: Depende de T003–T004 (estimativa). Idealmente após T015 existir o merge em `runChat`
- **US3 (P3)**: Independente para o assert estático; valor numérico ao vivo depende de US1

### Within Each User Story

- Testes primeiro (devem falhar) → implementação → checkpoint
- Strategies antes do merge HTTP quando US1
- Breakdown no `runChat` depois (ou junto) do merge de `promptTokens`

### Parallel Opportunities

- T001 ‖ T002
- T004 ‖ T003 (depois T001); T005 após T001; T006 após T005+T002
- T007 ‖ T008 ‖ T009 ‖ T010 ‖ T011 (testes US1)
- T012 ‖ T013 (react ‖ plan-and-execute); T014 após T006; T015 após tipos
- T017 ‖ T018 ‖ T019 (testes US2)
- T021 ‖ T022 (script)
- T023 ‖ validação parcial; T024 por último

---

## Parallel Example: User Story 1

```bash
# Testes US1 em paralelo (após foundation):
Task: "promptTokensFromLlmEnd em src/context/tokens.test.ts"
Task: "createLlmCallCounter em src/agents/metrics.test.ts"
Task: "runChat promptTokens em src/services/run-chat.test.ts"
Task: "HTTP 200 promptTokens em src/http/server.test.ts"
Task: "reflexão soma promptTokens em src/agents/reflection.test.ts"

# Strategies em paralelo:
Task: "react.ts metrics.promptTokens"
Task: "plan-and-execute.ts metrics.promptTokens"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + Phase 2
2. Phase 3 (US1) — `promptTokens` no `200`
3. **STOP** e validar: `npm run test -- src/agents/metrics.test.ts src/services/run-chat.test.ts src/http/server.test.ts`
4. Demo: curl `/chat` e ler `metrics.promptTokens`

### Incremental Delivery

1. Setup + Foundational → base pura + contador
2. US1 → tamanho real no chat (MVP)
3. US2 → breakdown por fonte
4. US3 → script confirmado
5. Polish → `summarizeMetrics` + typecheck/test verdes

### Parallel Team Strategy

1. Time fecha Setup + Foundational juntos
2. Depois: A = US1 (strategies + runChat promptTokens), B = US2 (breakdown + testes tokens), C = US3 (script)
3. Integrar e rodar T024

---

## Notes

- [P] = arquivos distintos, sem depender de tarefa incompleta no mesmo arquivo
- Spec FR-012 / constitution IV: testes obrigatórios nesta feature
- Não igualar `contextBreakdown` a `promptTokens`
- Refletor de aprendizado (009) **não** entra na soma de `promptTokens`
- Ensaio ao vivo de 30 turnos fica fora da suíte
- Commit por tarefa ou grupo lógico, se o usuário pedir
