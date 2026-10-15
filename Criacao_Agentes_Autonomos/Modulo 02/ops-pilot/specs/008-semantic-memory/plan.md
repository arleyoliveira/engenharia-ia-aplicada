# Implementation Plan: Memória semântica por usuário

**Branch**: `008-semantic-memory` | **Date**: 2026-09-18 | **Spec**: [spec.md](spec.md)

## Summary

Persistir fatos por `userId` com embeddings locais (`all-MiniLM-L6-v2`), expor `MemoryStore` (`remember` / `recall` / `forget`) com dedup ≥ 0,92 e recall top-3 (produto escalar, min 0,3), e injetar o recall no `POST /chat` quando `userId` for informado. Embeddings via `@huggingface/transformers` (mean + normalize) em lazy singleton; vetores em BLOB na tabela `memories` no mesmo SQLite do OpsStore.

## Technical Context

**Language/Version**: TypeScript ESM strict, Node.js 22 LTS

**Primary Dependencies**: Express, Zod, `node:sqlite` (`DatabaseSync`), `@huggingface/transformers` (NOVO), `node:test` via `tsx`

**Storage**: SQLite embarcado no mesmo `OPSPILOT_DB` (default `./data/opspilot.db`); tabela `memories` (`id`, `user_id`, `fact`, `embedding` BLOB, `created_at`); testes `:memory:` com conexão compartilhada

**Testing**: `node:test` + `tsx`; store SQLite `:memory:` + embeddings reais no teste semântico; `/chat` com `MemoryStore` fake + estratégia fake (sem rede LLM); primeiro download/cache do modelo local permitido

**Target Platform**: Serviço HTTP local (mesmo processo OpsPilot)

**Project Type**: Backend / web-service (extensão de `003` / `007`)

**Performance Goals**: Brute-force por `userId` (escala de curso); lazy load do modelo; sem SLA de rede para embeddings após cache

**Constraints**: Statements preparados; MVC (ranking/composição puros onde possível; IO no store/embeddings; HTTP na borda); env via flag nativa Node; `data/` no `.gitignore`; caminhos `src/memory/embeddings.ts` e `src/memory-store.ts` invariantes do pedido

**Scale/Scope**: 1 contrato `MemoryStore` + 1 impl SQLite + 1 fake; extensão de `ChatTurnInput` / composição / `runChat` / Zod de `/chat`; limiares fixos 0,92 / 0,3 / top-3; sem HTTP de remember/forget, auth ou TTL

## Constitution Check

*GATE: Passed before Phase 0 and rechecked after Phase 1 design.*

- [x] **I. Camadas explícitas**: `dotProduct` / composição de prompt = funções puras; persistência + load do modelo nas bordas (`memory-store`, `embeddings`); orquestração em `runChat` / HTTP.
- [x] **II. Validação na fronteira**: `userId` opcional no Zod de `/chat`; `userId`/`fact` não vazios nas operações do store (erro de domínio / validação).
- [x] **III. Erros de domínio**: falha de carga do modelo / entradas inválidas → erros de domínio traduzidos na borda (sem stack de IO).
- [x] **IV. Teste é parte da tarefa**: teste semântico sem palavra em comum; dedup; top-3; isolamento; injeção no chat com fake; typecheck/test verdes.
- [x] **V. Segurança por padrão**: sem dotenv; prepared statements; sem segredos; `userId` não autenticado nesta feature (fora de escopo, documentado).
- [x] **VI. Spec antes do código**: spec + este plano antes de implementar.
- [x] **VII. Persistência**: mesmo SQLite / `OPSPILOT_DB`; `:memory:` nos testes; fake para isolamento do HTTP.

## Project Structure

### Documentation (this feature)

```text
specs/008-semantic-memory/
├── checklists/requirements.md
├── contracts/chat-http.md
├── contracts/memory-store.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
└── spec.md
```

### Source Code (repository root)

```text
src/
├── memory/
│   └── embeddings.ts              # NOVO: lazy singleton pipeline (mean + normalize)
├── memory-store.ts                # NOVO: interface MemoryStore + SqliteMemoryStore (+ helpers BLOB)
├── memory-store.test.ts           # NOVO: :memory: + recall semântico / dedup / forget
├── store/
│   └── sqlite-ops-store.ts        # DDL tabela memories (mesmo initializeSchema)
├── services/
│   ├── compose-chat-prompt.ts     # estender: bloco de memórias no prompt
│   ├── run-chat.ts                # userId opcional → recall → inject
│   ├── run-chat.test.ts           # fake MemoryStore
│   └── default-store.ts           # getDefaultMemoryStore (db compartilhado)
├── agents/
│   └── types.ts                   # ChatTurnInput.memories?; Metrics.recalledMemories?
├── http/
│   ├── server.ts                  # userId no schema; DI memoryStore
│   └── server.test.ts             # injeção / ausência de userId
└── index.ts                       # wiring MemoryStore SQLite na composição
```

**Structure Decision**: Projeto único. Honrar caminhos do pedido (`src/memory/embeddings.ts`, `src/memory-store.ts` na raiz de `src/`). DDL de `memories` no schema do `SqliteOpsStore` (um dono / uma conexão). `SqliteMemoryStore` recebe `DatabaseSync` + `Embedder` injetável (default = singleton). Fake in-memory para testes de `/chat` sem carregar o modelo. Composição pura inclui memórias; `ReasoningStrategy.run` continua recebendo `StrategyInput` (string | `ChatTurnInput`).

## Phase 0: Research

Decisões em [research.md](research.md): modelo Xenova/all-MiniLM-L6-v2; BLOB Float32 LE; brute-force; dedup noop; forget scoped; composição com bloco “Memórias relevantes”; métrica `recalledMemories`; colisão de nome com `buildMemoryStore` (AlertStore).

## Phase 1: Design & Contracts

- Modelo: [data-model.md](data-model.md)
- Contratos: [contracts/memory-store.md](contracts/memory-store.md), [contracts/chat-http.md](contracts/chat-http.md)
- Validação executável: [quickstart.md](quickstart.md)

## Implementation Sequence

1. Adicionar `@huggingface/transformers`; implementar lazy singleton em `src/memory/embeddings.ts` (`embed(text) → Float32Array` normalizado).
2. Estender DDL do `SqliteOpsStore` com tabela `memories` + índice em `user_id`.
3. Implementar `MemoryStore` + `SqliteMemoryStore` em `src/memory-store.ts` (BLOB encode/decode, dedup 0,92, recall top-3 min 0,3, forget); testes `:memory:` incluindo recall sem palavra em comum.
4. Fake `MemoryStore` para testes de chat (sem modelo).
5. Estender `ChatTurnInput` / `composeChatPrompt` / `toAgentMessages` (ou prefixo no message) com fatos de recall; constante de formatação estável.
6. Estender `runChat` + Zod/`createChatServer` com `userId` opcional e DI `memoryStore`; métrica `recalledMemories`.
7. Wiring em `default-store` / `index.ts`.
8. Testes HTTP + `npm run typecheck` / `npm run test` verdes.

## Complexity Tracking

Nenhuma violação constitucional requer justificativa. Nota: `buildMemoryStore()` existente em `default-store.ts` é o AlertStore in-memory legado — **não** confundir com o novo `MemoryStore` semântico; não renomear nesta feature (evitar churn fora de escopo).
