---

description: "Task list for history summarization / pruning"
---

# Tasks: Sumarização de histórico (pruning)

**Input**: Design documents from `/specs/011-history-summarization/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, constitution

**Tests**: Spec exige testes fake (FR-009 / US3): janela 8, consolidação em lote, mescla, injeção no contexto, ausência de re-sumarização a cada request, evento `summarize` só na consolidação. Sem rede. Store `:memory:` para DDL/resumo.

**Organization**: Por história. Contratos: [contracts/conversation-summary-store.md](contracts/conversation-summary-store.md), [contracts/history-summarizer.md](contracts/history-summarizer.md), [contracts/chat-http.md](contracts/chat-http.md).

**Prompt de produção (obrigatório)**:

```ts
export const SUMMARIZER_PROMPT = `Comprima o trecho de conversa a seguir em no máximo 150 tokens, preservando obrigatoriamente: decisões tomadas, fatos estabelecidos (nomes, datas, prazos, preferências), incidentes abertos/resolvidos e pendêncais abertas. Descarte cumprimetos e conversa social. Se houver um resumo anterior, incorpore-o. Responda só o resumo, em tópicos telegráficos.`;
```

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos distintos, sem dependência incompleta)
- **[Story]**: US1 / US2 / US3
- Incluir caminhos de arquivo exatos

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Tipos, constantes e esqueletos de módulo.

- [X] T001 [P] Em `src/agents/types.ts`: adicionar `TraceEvent` `{ type: "summarize"; content: string }`; estender `ChatTurnInput` com `summary?: string`; estender `ContextBreakdown` com `summary: number`
- [X] T002 [P] Em `src/context/tokens.ts`: alinhar `ContextBreakdown` / `ContextBreakdownInput` com `summary?: string` (ou texto opcional) e incluir `summary: estimateTokens(...)` em `estimateContextBreakdown`
- [X] T003 [P] Em `src/services/compose-chat-prompt.ts`: definir `HISTORY_WINDOW = 8`, `PRUNE_BATCH_SIZE = 8`, `SUMMARY_TARGET_TOKENS = 150` (exportar as três)
- [X] T004 Criar esqueleto `src/services/history-summarizer.ts` exportando `SUMMARIZER_PROMPT` (texto exato acima), tipo `HistorySummarizer` / `SummarizeInput` conforme [contracts/history-summarizer.md](contracts/history-summarizer.md)
- [X] T005 [P] Criar esqueleto `src/services/history-pruning.ts` com exports previstos (`maybeConsolidate` ou equivalente puro+orquestração)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DDL, store, janela 8, sumarizador (fake + prod), formatação de prompt com resumo — bloqueia as histórias.

**⚠️ CRITICAL**: Nenhuma história começa antes desta fase

- [X] T006 Em `src/store/sqlite-ops-store.ts` (`ensureSchema`): DDL idempotente `conversation_summaries` (`conversation_id` PK/FK, `summary` TEXT NOT NULL, `covered_through_message_id` INTEGER NOT NULL CHECK >= 0, `updated_at`) conforme [data-model.md](data-model.md)
- [X] T007 Em `src/store/conversation-store.ts`: estender `ConversationStore` com `getSummary`, `upsertSummary`, `messagesBefore` + tipo `ConversationSummary` ([contracts/conversation-summary-store.md](contracts/conversation-summary-store.md))
- [X] T008 Implementar os três métodos em `src/store/sqlite-conversation-store.ts` (prepared statements; `NotFoundError` / `InvalidStateError` como hoje)
- [X] T009 [P] Implementar os três métodos em `src/store/memory-conversation-store.ts` (Map em memória; mesma semântica de cursor/`messagesBefore`)
- [X] T010 Em `src/services/compose-chat-prompt.ts`: propagar `summary` em `normalizeChatTurnInput`; injetar bloco `Resumo da conversa:\n<summary>\n\n` em `composeChatPrompt` e `toAgentMessages` (antes de memórias/histórico, se `summary` não vazio)
- [X] T011 Em `src/agents/trace.ts`: `formatEvent` para `summarize` → `[summarize] <content>`
- [X] T012 Em `src/services/history-summarizer.ts`: implementar `createFakeHistorySummarizer()` determinístico (sem rede; ecoa batch + `previous` se houver; `estimateTokens` na faixa ~120..180; marcações assertáveis de decisão/fato/pendência quando presentes no material)
- [X] T013 Em `src/services/history-summarizer.ts`: implementar `createLlmHistorySummarizer()` (ou default) usando `createModel()` de `src/agents/model.ts`, system = `SUMMARIZER_PROMPT`, user = resumo anterior (se houver) + lote formatado `role: content`; retornar só o texto trimado; falha propaga
- [X] T014 Em `src/services/history-pruning.ts`: função pura/orquestração — dados `history` (≤8), `getSummary`, `messagesBefore`, `summarizer`: consolidar só se `history.length === HISTORY_WINDOW` e candidatos ≥ `PRUNE_BATCH_SIZE`; consumir exatamente 8 mais antigos; `upsertSummary(text, batch[7].id)`; retornar `{ summaryText, didSummarize, summarizeContent? }`

**Checkpoint**: Foundation pronta — store + fake summarizer + pruning testáveis sem `runChat` completo

---

## Phase 3: User Story 1 - Conversas longas preservam o essencial (Priority: P1) 🎯 MVP

**Goal**: Janela crua 8; consolidação do primeiro lote → resumo persistido mesclado ~150 tokens; resumo no contexto; evento `summarize` no turn de consolidação.

**Independent Test**: Store fake + summarizer fake; seed ≥ 16 msgs; um `runChat` → `historyMessages === 8`, strategy recebe `summary`, `trace` contém `summarize`, `getSummary` gravado. Sem rede.

### Tests for User Story 1

> Escrever primeiro; devem falhar antes da wiring completa em `runChat`.

- [X] T015 [P] [US1] Em `src/store/sqlite-conversation-store.test.ts`: cobrir DDL/`upsertSummary`/`getSummary`/`messagesBefore` com `SqliteOpsStore(":memory:")`
- [X] T016 [P] [US1] Em `src/services/history-summarizer.test.ts`: fake com/sem `previous`; `estimateTokens` na faixa; ecoa eixos quando o batch traz marcadores
- [X] T017 [P] [US1] Em `src/services/history-pruning.test.ts`: ≤8 msgs → não consolida; 8 candidatos → consolida uma vez e atualiza cursor; mescla chama summarizer com `previous`
- [X] T018 [P] [US1] Em `src/services/compose-chat-prompt.test.ts` (criar se não existir): com `summary` o texto/mensagens incluem `Resumo da conversa:`; sem summary comportamento atual (memórias/histórico)
- [X] T019 [P] [US1] Em `src/services/run-chat.test.ts`: seed `HISTORY_WINDOW + PRUNE_BATCH_SIZE` msgs → consolidação; `historyMessages === 8`; `lastInput.summary` definido; `trace` tem evento `summarize`; `contextBreakdown.summary > 0`
- [X] T020 [P] [US1] Em `src/agents/trace.test.ts`: `formatTrace` renderiza `[summarize]`

### Implementation for User Story 1

- [X] T021 [US1] Em `src/services/run-chat.ts`: estender `RunChatDeps` com `summarizer?: HistorySummarizer`; após `lastMessages`, se `summarizer` presente chamar pruning; passar `summary` no `strategy.run`; merge `contextBreakdown` com summary; se `didSummarize`, prepend `{ type: "summarize", content }` ao `trace`
- [X] T022 [US1] Ajustar teste de overflow existente em `src/services/run-chat.test.ts` (ex-12 → `HISTORY_WINDOW` dinâmico = 8) e fixtures que assumiam 12
- [X] T023 [US1] Em `src/http/server.ts` / `src/index.ts`: DI do summarizer de produção (`createLlmHistorySummarizer`) na composição que chama `runChat` (espelhar padrão `memory`/`learning`); testes HTTP continuam injetando fake

**Checkpoint**: US1 — resumo no contexto + evento na consolidação

---

## Phase 4: User Story 2 - Sumarização só em lote, nunca a cada request (Priority: P2)

**Goal**: Turns intermediários reutilizam o resumo persistido sem chamar o summarizer nem emitir `summarize` até fechar o próximo lote de 8.

**Independent Test**: Após primeira consolidação, vários `runChat` com < 8 novas fora da janela → zero chamadas extras ao summarizer / zero novos `summarize`; ao fechar o 2º lote → exatamente uma nova consolidação (mescla).

### Tests for User Story 2

- [X] T024 [P] [US2] Em `src/services/run-chat.test.ts`: spy/contador no fake summarizer — após 1ª consolidação, N turns mid-lote → `callCount` estável e nenhum `summarize` novo no trace; summary text idêntico no `lastInput`
- [X] T025 [P] [US2] Em `src/services/run-chat.test.ts` (ou `history-pruning.test.ts`): segundo lote de 8 → uma nova chamada; `upsert` com `coveredThrough` avançado; summarizer recebe `previous` = texto da 1ª consolidação

### Implementation for User Story 2

- [X] T026 [US2] Garantir em `src/services/history-pruning.ts` + `run-chat.ts` que elegibilidade usa só `covered_through_message_id` + janela (sem consolidar por request); falha de summarize/upsert no turn elegível propaga erro (não 200 silencioso)

**Checkpoint**: US2 — custo de sumarizar só a cada lote de 8

---

## Phase 5: User Story 3 - Validar com fakes, sem rede (Priority: P3)

**Goal**: Suíte HTTP + stores fake/` :memory:` cobre pruning sem disco de produção e sem OpenRouter.

**Independent Test**: `npm run test -- src/http/server.test.ts src/store/sqlite-conversation-store.test.ts src/services/run-chat.test.ts` verdes sem rede e sem `./data/opspilot.db`.

### Tests for User Story 3

- [X] T027 [P] [US3] Em `src/http/server.test.ts`: com `MemoryConversationStore` + fake summarizer + strategy fake, conversa longa o bastante → `metrics.historyMessages <= 8`; turn de consolidação inclui `summarize` no `trace`; `contextBreakdown.summary` presente
- [X] T028 [P] [US3] Em `src/http/server.test.ts`: regressão 400/404/422/504 + `promptTokens` / memórias inalterados no contrato de erro

### Implementation for User Story 3

- [X] T029 [US3] Expor factory `createFakeHistorySummarizer` (já em T012) usável pelos testes HTTP via deps de `createChatServer` / handler (estender options se necessário em `src/http/server.ts`)
- [X] T030 [US3] Confirmar que caminhos sem `summarizer` injetado não quebram (só janela 8, sem consolidação) — cobrir um assert mínimo em `run-chat.test.ts`

**Checkpoint**: US3 — quickstart cenários 1–3 cobertos por teste

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Consistência, typecheck e validação do quickstart.

- [X] T031 [P] Em `src/context/tokens.test.ts`: `estimateContextBreakdown` com `summary` vazio → 0; com texto conhecido → `floor(chars/4)`
- [X] T032 [P] Atualizar asserts/docs locais que ainda digam janela 12 (comentários em `compose-chat-prompt.ts`, contratos internos de teste) para 8
- [X] T033 Rodar validação [quickstart.md](quickstart.md): `npm run typecheck` e `npm run test` verdes
- [X] T034 [P] Revisar aderência à constituição (camadas, Zod na fronteira HTTP inalterada, prepared statements, `:memory:` / fake, sem segredos)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: imediato
- **Foundational (Phase 2)**: depende do Setup — **bloqueia** todas as histórias
- **US1 (Phase 3)**: após Foundational — MVP
- **US2 (Phase 4)**: após US1 (reusa consolidação + contador de calls)
- **US3 (Phase 5)**: após US1 (HTTP); idealmente após US2 para cobrir mid-lote no server se desejado
- **Polish (Phase 6)**: após histórias desejadas

### User Story Dependencies

- **US1 (P1)**: após Phase 2 — sem dependência de US2/US3
- **US2 (P2)**: depende do pipeline de consolidação da US1
- **US3 (P3)**: depende de fake + DI; valida ponta a ponta

### Within Each User Story

- Testes primeiro (falhar) → implementação → checkpoint

### Parallel Opportunities

- T001–T005 (setup) em paralelo onde marcado [P]
- T008 vs T009 (sqlite vs memory store)
- T015–T020 (testes US1) em paralelo
- T024–T025 (testes US2) em paralelo
- T027–T028 (testes US3) em paralelo
- T031–T032, T034 em paralelo no polish

---

## Parallel Example: User Story 1

```bash
# Testes US1 em paralelo:
Task: "sqlite-conversation-store.test.ts — summary + messagesBefore"
Task: "history-summarizer.test.ts — fake"
Task: "history-pruning.test.ts — elegibilidade"
Task: "compose-chat-prompt.test.ts — bloco Resumo"
Task: "run-chat.test.ts — consolidação + summarize event"
Task: "trace.test.ts — format summarize"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + 2 (DDL, store, `SUMMARIZER_PROMPT`, fake, pruning, prompt)
2. Phase 3 US1 (`runChat` + evento + DI prod)
3. **STOP**: validar consolidação com fake sem rede

### Incremental Delivery

1. US1 → demo: resumo no contexto + `summarize` no trace
2. US2 → garantia de não re-sumarizar a cada request
3. US3 → HTTP + quickstart verdes
4. Polish → typecheck/test + constituição

### Parallel Team Strategy

1. Dev A: store SQLite + DDL
2. Dev B: summarizer (`SUMMARIZER_PROMPT` + fake + LLM) + compose prompt
3. Após Phase 2: Dev A US1 `runChat`; Dev B testes US2/US3

---

## Notes

- `SUMMARIZER_PROMPT` é invariante do pedido do `/speckit-tasks` — usar o texto literal em `src/services/history-summarizer.ts` (não parafrasear).
- Typos do prompt (`pendêncais`, `cumprimetos`) permanecem como fornecidos, a menos que o implementador receba correção explícita depois.
- [P] = arquivos distintos sem dependência incompleta
- Sem `summarizer` em deps ⇒ só janela 8 (sem consolidação)
- Commit por tarefa ou grupo lógico; não criar `tasks.md` de outra feature
