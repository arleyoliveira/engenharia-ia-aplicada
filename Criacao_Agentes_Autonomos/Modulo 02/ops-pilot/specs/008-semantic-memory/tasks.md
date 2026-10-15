---

description: "Task list for semantic memory / MemoryStore"
---

# Tasks: Memória semântica por usuário

**Input**: Design documents from `/specs/008-semantic-memory/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, constitution

**Tests**: Spec exige testes (FR-011 / constituição IV): recall sem palavra em comum, dedup, top-3, isolamento, injeção no `/chat` com fake.

**Organization**: Por história. Contratos: [contracts/memory-store.md](contracts/memory-store.md), [contracts/chat-http.md](contracts/chat-http.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo
- **[Story]**: US1 / US2 / US3
- Incluir caminhos de arquivo exatos

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependência, tipos e pipeline de embedding.

- [X] T001 Adicionar `@huggingface/transformers` em `package.json` (`npm install`)
- [X] T002 [P] Criar lazy singleton `embed(text)` em `src/memory/embeddings.ts` (`Xenova/all-MiniLM-L6-v2`, `pooling: "mean"`, `normalize: true`; erro de domínio se carga falhar)
- [X] T003 [P] Estender `ChatTurnInput` com `memories?: readonly string[]` e `Metrics` com `recalledMemories?: number` em `src/agents/types.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema + contrato `MemoryStore` + impl SQLite + fake — bloqueia histórias.

**⚠️ CRITICAL**: Nenhuma história começa antes desta fase

- [X] T004 Estender DDL em `src/store/sqlite-ops-store.ts` com tabela `memories` (`id`, `user_id`, `fact`, `embedding` BLOB, `created_at`) + índice `idx_memories_user_id` (idempotente)
- [X] T005 [P] Definir em `src/memory-store.ts`: constantes `DEDUP_THRESHOLD=0.92`, `RECALL_MIN_SCORE=0.3`, `RECALL_TOP_K=3`; tipos `RecallHit`, `Embedder`, `MemoryStore`; helpers puros `dotProduct` + encode/decode BLOB Float32 LE
- [X] T006 Implementar `SqliteMemoryStore` em `src/memory-store.ts` (`remember` / `recall` / `forget`; recebe `DatabaseSync` + `Embedder` opcional default `embed`; statements preparados; validação trim → `InvalidStateError`)
- [X] T007 [P] Implementar fake `InMemoryMemoryStore` (ou equivalente) no mesmo `src/memory-store.ts` ou `src/memory/fake-memory-store.ts` para testes de chat sem modelo HF
- [X] T008 Wiring `getDefaultMemoryStore()` em `src/services/default-store.ts` sobre o mesmo `DatabaseSync` do ops store (JSDoc: não confundir com `buildMemoryStore` AlertStore)

**Checkpoint**: Foundation pronta — embeddings + DDL + MemoryStore injetável

---

## Phase 3: User Story 1 - Lembrar e recuperar fatos por significado (Priority: P1) 🎯 MVP

**Goal**: `remember` + `recall` por `userId`; recall encontra fato sem palavra em comum; isolamento entre usuários.

**Independent Test**: `npm run test -- src/memory-store.test.ts` — remember fato; recall com paráfrase sem tokens em comum → hit score ≥ 0,3; user B invisível para A.

### Tests for User Story 1

- [X] T009 [P] [US1] Em `src/memory-store.test.ts`, teste com embedder **real**: `remember("prefiro alertas em português")` + `recall` sem palavras em comum (ex. idioma das notificações) → fato no top-3 com score ≥ 0,3 (timeout generoso / 1ª descarga do modelo OK)
- [X] T010 [P] [US1] Em `src/memory-store.test.ts`, isolamento: memórias de user B não aparecem no `recall` de A (pode usar `Embedder` fake determinístico)

### Implementation for User Story 1

- [X] T011 [US1] Garantir `remember`/`recall` em `src/memory-store.ts` conforme contrato (top-3, min 0,3, empate `created_at` DESC + `id` DESC); ajustar até T009/T010 passarem

**Checkpoint**: US1 — memória semântica recuperável e isolada

---

## Phase 4: User Story 2 - Dedup ≥ 0,92 e forget (Priority: P2)

**Goal**: Não duplicar fatos quase iguais; `forget` remove só no escopo do `userId`.

**Independent Test**: Segundo `remember` com sim ≥ 0,92 → `null` e 1 linha; `forget` → recall vazio; forget de outro user → `false`.

### Tests for User Story 2

- [X] T012 [P] [US2] Em `src/memory-store.test.ts`, dedup: dois textos com vetores quase iguais (Embedder fake ou real) → segundo `remember` retorna `null` e count=1
- [X] T013 [P] [US2] Em `src/memory-store.test.ts`, `forget(userId, id)` remove; id inexistente / outro user → `false` sem efeito colateral

### Implementation for User Story 2

- [X] T014 [US2] Completar/ajustar dedup em `remember` e `forget` em `src/memory-store.ts` até T012/T013 passarem

**Checkpoint**: US2 — dedup e esquecimento

---

## Phase 5: User Story 3 - Chat injeta recall no prompt (Priority: P3)

**Goal**: `userId` opcional em `POST /chat`; recall injetado via composição; métrica `recalledMemories`.

**Independent Test**: Fake MemoryStore + fake strategy — com `userId` o prompt/estratégia recebe fatos e `recalledMemories=N`; sem `userId` comportamento 007.

### Tests for User Story 3

- [X] T015 [P] [US3] Em `src/services/compose-chat-prompt.test.ts` (ou junto de `compose-chat-prompt.ts`), assert do bloco `Memórias relevantes:` quando `memories` não vazio; omitir bloco se vazio
- [X] T016 [P] [US3] Em `src/services/run-chat.test.ts`, com fake MemoryStore: `userId` → `recalledMemories` e `strategy` recebe `memories`; sem `userId` → sem recall
- [X] T017 [P] [US3] Em `src/http/server.test.ts`: `userId` válido injeta memórias; `userId: "   "` → 400; regressão `conversationId` / 404 / 422 / 504

### Implementation for User Story 3

- [X] T018 [US3] Estender `composeChatPrompt` / `normalizeChatTurnInput` / `toAgentMessages` em `src/services/compose-chat-prompt.ts` com bloco estável de memórias (contrato chat-http)
- [X] T019 [US3] Estender `runChat` em `src/services/run-chat.ts`: `ChatInput.userId?`, `RunChatDeps.memory?`; se ambos presentes → `recall` → passar `memories` + merge `recalledMemories`
- [X] T020 [US3] Estender Zod + DI em `src/http/server.ts` (`userId` opcional; `memoryStore?`); repassar a `runChat`
- [X] T021 [US3] Wiring de produção em `src/index.ts` (e default em `createChatServer` / `getDefaultMemoryStore`)

**Checkpoint**: US3 — chat com memória semântica

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validação final alinhada ao quickstart.

- [X] T022 [P] Revisar JSDoc em `src/services/default-store.ts` distinguindo `buildMemoryStore` (AlertStore) vs `getDefaultMemoryStore` (semântico)
- [X] T023 Rodar validação [quickstart.md](quickstart.md): `npm run typecheck` e `npm run test`; corrigir regressões

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências
- **Foundational (Phase 2)**: Depende do Setup — **BLOQUEIA** todas as histórias
- **US1 (Phase 3)**: Após Foundational — MVP
- **US2 (Phase 4)**: Após Foundational (idealmente após US1; dedup/forget já no store)
- **US3 (Phase 5)**: Após Foundational (precisa `MemoryStore` + tipos; não precisa do teste semântico HF para o fake)
- **Polish (Phase 6)**: Após histórias desejadas

### User Story Dependencies

- **US1 (P1)**: Só Foundational — recall semântico
- **US2 (P2)**: Só Foundational — dedup/forget (compartilha `src/memory-store.ts` com US1)
- **US3 (P3)**: Foundational + tipos de Setup; usa fake, independente do modelo HF

### Parallel Opportunities

- T002 ∥ T003 (Setup)
- T005 ∥ T007 após T004/T006 interface (Foundational: T005 antes de T006; T007 ∥ T008 após interface)
- T009 ∥ T010 (testes US1)
- T012 ∥ T013 (testes US2)
- T015 ∥ T016 ∥ T017 (testes US3, arquivos distintos)
- Após Foundational, US1 testes HF e US3 (fake) podem avançar em paralelo se cuidarem de conflitos em `memory-store.ts`

---

## Parallel Example: User Story 1

```bash
# Testes US1 em paralelo (após SqliteMemoryStore):
Task: "T009 recall semântico real em src/memory-store.test.ts"
Task: "T010 isolamento por userId em src/memory-store.test.ts"
```

## Parallel Example: User Story 3

```bash
# Testes US3 em paralelo:
Task: "T015 compose-chat-prompt.test.ts"
Task: "T016 run-chat.test.ts com fake MemoryStore"
Task: "T017 server.test.ts userId / 400"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 US1 (remember/recall + teste sem palavra em comum)
3. **STOP e VALIDAR** com `npm run test -- src/memory-store.test.ts`

### Incremental Delivery

1. Setup + Foundational
2. US1 → demo recall semântico
3. US2 → dedup + forget
4. US3 → `/chat` com `userId`
5. Polish → typecheck + suíte completa

### Parallel Team Strategy

1. Setup + Foundational juntos
2. Dev A: US1 (HF); Dev B: US3 (fake/chat) em arquivos distintos; Dev C: US2 testes dedup/forget após store estável

---

## Notes

- Não renomear `buildMemoryStore` (AlertStore legado)
- Caminhos invariantes: `src/memory/embeddings.ts`, `src/memory-store.ts`
- 1ª execução do teste semântico pode baixar o modelo (cache HF)
- Commit após cada tarefa ou grupo lógico
- Próximo comando: `/speckit-implement`
