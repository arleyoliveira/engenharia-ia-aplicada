---

description: "Task list for persistent conversation / runChat"
---

# Tasks: Conversa persistente no chat

**Input**: Design documents from `/specs/007-persistent-conversation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, constitution

**Tests**: Spec exige testes `:memory:` + fake (FR-010/011 / US3).

**Organization**: Por história. Orquestração canônica em `runChat` (referência do implement):

```ts
// src/services/run-chat.ts — forma alvo
export async function runChat(input: ChatInput, deps: RunChatDeps) {
  const conversationId = input.conversationId ?? deps.conversation.create();
  const history = deps.conversation.lastMessages(conversationId, HISTORY_WINDOW);
  deps.conversation.append(conversationId, { role: "user", content: input.message });
  const result = await deps.strategy.run({ message: input.message, history });
  deps.conversation.append(conversationId, { role: "assistant", content: result.answer });
  return {
    conversationId,
    ...result,
    metrics: { ...result.metrics, historyMessages: history.length },
  };
}
```

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo
- **[Story]**: US1 / US2 / US3
- Incluir caminhos de arquivo exatos

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Tipos e contratos base.

- [X] T001 [P] Criar `src/store/conversation-store.ts` com `MessageRole`, `ConversationMessage`, `ConversationStore` (`create` / `append` / `lastMessages`)
- [X] T002 [P] Estender `Metrics` com `historyMessages?: number` em `src/agents/types.ts`; tipar `ChatTurnInput` e permitir `ReasoningStrategy.run(string | ChatTurnInput)`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persistência + fake + DDL — bloqueia histórias.

**⚠️ CRITICAL**: Nenhuma história começa antes desta fase

- [X] T003 Estender DDL em `src/store/sqlite-ops-store.ts` com tabelas `conversations` e `messages` (CHECK role, FK, idempotente)
- [X] T004 [P] Implementar `SqliteConversationStore` em `src/store/sqlite-conversation-store.ts` (recebe `DatabaseSync`)
- [X] T005 [P] Implementar `MemoryConversationStore` em `src/store/memory-conversation-store.ts`
- [X] T006 Testes `:memory:` em `src/store/sqlite-conversation-store.test.ts` (create/append/lastMessages, limite, NotFound, limit&lt;1)
- [X] T007 [P] Constante `HISTORY_WINDOW = 12` e helpers de normalização de input em `src/services/compose-chat-prompt.ts` (mapear history → mensagens para o agente)

**Checkpoint**: Foundation pronta — store + tipos

---

## Phase 3: User Story 1 - Continuar plantão no mesmo fio (Priority: P1) 🎯 MVP

**Goal**: `conversationId` opcional; `runChat` persiste user/assistant e devolve id.

**Independent Test**: Fake store + fake strategy via `runChat` / `POST /chat`.

### Tests for User Story 1

- [X] T008 [P] [US1] Testes de `runChat` em `src/services/run-chat.test.ts` (cria id, ecoa id, NotFound)
- [X] T009 [P] [US1] Estender `src/http/server.test.ts` para `conversationId` no `200` e `404` inexistente

### Implementation for User Story 1

- [X] T010 [US1] Implementar `runChat` em `src/services/run-chat.ts` conforme referência (create → lastMessages → append user → strategy.run({message,history}) → append assistant → metrics.historyMessages)
- [X] T011 [US1] Atualizar estratégias (`src/agents/react.ts`, `plan-and-execute.ts`, `reflection.ts`) para aceitar `ChatTurnInput` e injetar history no invoke
- [X] T012 [US1] Estender Zod + handler em `src/http/server.ts`: `conversationId` opcional; chamar `runChat`; mapear `NotFoundError` → 404; resposta com `conversationId`
- [X] T013 [US1] Wiring default `conversationStore` em `src/http/server.ts` / `src/services/default-store.ts` / `src/index.ts`

**Checkpoint**: US1 — fio de conversa funcional

---

## Phase 4: User Story 2 - Janela de 12 + historyMessages (Priority: P2)

**Goal**: No máximo 12 mensagens no history; métrica correta.

**Independent Test**: Store com &gt;12 msgs; `historyMessages === 12`.

### Tests for User Story 2

- [X] T014 [P] [US2] Em `src/services/run-chat.test.ts`, cobrir janela 12 e `historyMessages` (0 no primeiro turn; 12 com overflow)

### Implementation for User Story 2

- [X] T015 [US2] Garantir `lastMessages(..., HISTORY_WINDOW)` e merge de `historyMessages` em `src/services/run-chat.ts`
- [X] T016 [US2] Assert em `src/http/server.test.ts` que `metrics.historyMessages` aparece no `200`

**Checkpoint**: US2 — janela e métrica

---

## Phase 5: User Story 3 - Testes :memory: + fake (Priority: P3)

**Goal**: Suíte determinística sem disco/rede.

**Independent Test**: quickstart cenários 1–3.

### Implementation for User Story 3

- [X] T017 [US3] Confirmar `MemoryConversationStore` usado nos testes HTTP; SQLite `:memory:` nos testes de store
- [X] T018 [US3] Rodar `npm run typecheck` e `npm run test`; corrigir regressões

**Checkpoint**: US3 — suíte verde

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T019 [P] Atualizar `specs/007-persistent-conversation/contracts/chat-http.md` se o fluxo append-antes-do-run divergir do texto (alinhar à referência runChat)
- [X] T020 Validar quickstart.md (comandos de teste)

---

## Dependencies & Execution Order

- Setup → Foundational → US1 → US2 → US3 → Polish
- US2 depende de `runChat` (US1)
- T004/T005 paralelos após T003; T008/T009 paralelos antes de fechar HTTP

## MVP

Phases 1–3 (US1): conversa com id + `runChat` + `/chat`.

## Notes

- Referência do usuário prevalece sobre research R5 (append user **antes** do run) e R3 (strategy recebe `{ message, history }`, não só string composta).
- `historyMessages` = `history.length` **antes** do append do user atual.
