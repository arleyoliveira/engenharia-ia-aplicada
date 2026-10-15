# Implementation Plan: Conversa persistente no chat

**Branch**: `007-persistent-conversation` | **Date**: 2026-09-18 | **Spec**: [spec.md](spec.md)

## Summary

Persistir fios de conversa no SQLite embarcado (mesma base do `SqliteOpsStore`), expor `conversationId` opcional em `POST /chat`, injetar as 12 mensagens mais recentes no prompt via composição pura, e reportar `metrics.historyMessages`. Contrato `ConversationStore` (`create` / `append` / `lastMessages`) com implementação SQLite + fake em memória; testes em `:memory:` e integração HTTP sem rede.

## Technical Context

**Language/Version**: TypeScript ESM strict, Node.js 22 LTS

**Primary Dependencies**: Express, Zod, `node:sqlite` (`DatabaseSync`), `node:test` via `tsx` (sem novas deps externas)

**Storage**: SQLite embarcado no mesmo `OPSPILOT_DB` (default `./data/opspilot.db`); tabelas `conversations` + `messages`; testes `:memory:` com **uma** conexão compartilhada

**Testing**: `node:test` + `tsx`; store SQLite em `:memory:`; `/chat` com `ConversationStore` fake + estratégia fake (sem rede)

**Target Platform**: Serviço HTTP local (mesmo processo OpsPilot)

**Project Type**: Backend / web-service (extensão do endpoint `003-chat-endpoint`)

**Performance Goals**: Janela fixa de 12 mensagens; leitura via statement preparado com `LIMIT`; sem SLA de rede

**Constraints**: Statements preparados; sem SQL concatenado; MVC (domínio puro na composição do prompt; IO no store; HTTP na borda); env via flag nativa Node; `data/` no `.gitignore`

**Scale/Scope**: 1 contrato de store + 1 impl SQLite + 1 fake; extensão de `POST /chat` e `Metrics`; janela constante 12; sem listagem/exclusão/auth/streaming

## Constitution Check

*GATE: Passed before Phase 0 and rechecked after Phase 1 design.*

- [x] **I. Camadas explícitas**: composição do prompt = função pura; persistência em `src/store/`; orquestração do turn na borda HTTP / serviço fino; estratégias continuam recebendo `string`.
- [x] **II. Validação na fronteira**: `conversationId` opcional validado com Zod no schema de `/chat`.
- [x] **III. Erros de domínio**: `NotFoundError` para id inexistente; traduzido em HTTP 404 na borda (sem SQL).
- [x] **IV. Teste é parte da tarefa**: testes store `:memory:` + integração chat com fake; typecheck/test verdes.
- [x] **V. Segurança por padrão**: sem dotenv; prepared statements; sem segredos.
- [x] **VI. Spec antes do código**: spec + este plano antes de implementar.
- [x] **VII. Persistência**: mesmo SQLite / `OPSPILOT_DB`; `:memory:` nos testes; mock/fake para isolamento.

## Project Structure

### Documentation (this feature)

```text
specs/007-persistent-conversation/
├── checklists/requirements.md
├── contracts/chat-http.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
└── spec.md
```

### Source Code (repository root)

```text
src/
├── agents/
│   └── types.ts                    # Metrics + historyMessages
├── errors.ts                       # NotFoundError (reuso)
├── http/
│   ├── server.ts                   # conversationId no schema; orquestra turn
│   └── server.test.ts              # fake ConversationStore + fake strategy
├── services/
│   ├── compose-chat-prompt.ts      # NOVO: puro — histórico + mensagem atual
│   ├── default-store.ts            # wiring ConversationStore a partir do mesmo db
│   └── chat-turn.ts                # NOVO (opcional): resolve id, load, compose, run, append
├── store/
│   ├── sqlite-ops-store.ts         # DDL conversations + messages (mesmo initializeSchema)
│   ├── conversation-store.ts       # NOVO: interface ConversationStore + tipos Message
│   ├── sqlite-conversation-store.ts # NOVO: impl sobre DatabaseSync compartilhado
│   ├── memory-conversation-store.ts # NOVO: fake para testes
│   └── sqlite-conversation-store.test.ts
└── index.ts                        # composição: ops store + conversation store no chat server
```

**Structure Decision**: Projeto único. DDL de conversa no schema do `SqliteOpsStore` (um dono do schema / uma conexão). `SqliteConversationStore` recebe `DatabaseSync` (evita dois `:memory:` isolados). Composição do prompt é pura; o handler (ou `chat-turn`) orquestra sem mudar a assinatura `ReasoningStrategy.run(string)`.

## Phase 0: Research

Decisões em [research.md](research.md): store separado sobre db compartilhado; UUID; janela 12; composição textual; merge de `historyMessages`; HTTP 404; N ≤ 0 rejeitado; append só após sucesso da estratégia.

## Phase 1: Design & Contracts

- Modelo: [data-model.md](data-model.md)
- Contrato HTTP estendido: [contracts/chat-http.md](contracts/chat-http.md)
- Validação executável: [quickstart.md](quickstart.md)

## Implementation Sequence

1. Definir `ConversationStore` + tipos `ConversationMessage` / papéis em `src/store/conversation-store.ts`.
2. Estender DDL do `SqliteOpsStore` com `conversations` e `messages` (idempotente, CHECK de role).
3. Implementar `SqliteConversationStore(db)` e `MemoryConversationStore`; testes `:memory:` (create/append/lastMessages, limite N, id inexistente).
4. Função pura `composeChatPrompt(history, message)` + constante `HISTORY_WINDOW = 12`.
5. Estender `Metrics` com `historyMessages`; schema Zod de `/chat` com `conversationId` opcional; handler orquestra create/load/compose/run/append e devolve `conversationId` + métrica.
6. Mapear `NotFoundError` → 404 na borda HTTP.
7. Wiring em composição (`createChatServer({ conversationStore })` / default a partir do db do ops store).
8. Atualizar testes de `server.test.ts` (fake store); typecheck + test verdes.

## Complexity Tracking

Nenhuma violação constitucional requer justificativa.
