# Research: Conversa persistente no chat

**Date**: 2026-09-18 | **Feature**: [spec.md](spec.md)

Nenhuma pendência de esclarecimento no Technical Context. Decisões abaixo alinham a spec, a constituição VII e o padrão atual de `SqliteOpsStore` + `POST /chat`.

## R1. Onde vive o schema e a conexão

- **Decision**: Adicionar DDL de `conversations` e `messages` em `SqliteOpsStore.initializeSchema()` (mesmo `DatabaseSync` / `OPSPILOT_DB`). Implementar `SqliteConversationStore` como classe separada que recebe `DatabaseSync` já aberto (ex.: `opsStore.db`).
- **Rationale**: Dois `new DatabaseSync(":memory:")` não compartilham dados; um único schema owner evita drift; a interface `ConversationStore` permanece testável e injetável sem acoplar o chat a `OpsStore`.
- **Alternatives considered**: (a) `SqliteOpsStore implements ConversationStore` — mistura contratos; (b) segundo arquivo SQLite só para chat — viola “mesmo banco” da spec; (c) abrir path duas vezes — quebra `:memory:`.

## R2. Contrato `ConversationStore`

- **Decision**:
  - `create(): string` — gera id opaco (`crypto.randomUUID()`), insere em `conversations`, devolve o id.
  - `append(conversationId, message: { role, content }): void` — valida existência da conversa; rejeita id desconhecido com `NotFoundError`.
  - `lastMessages(conversationId, limit: number): ConversationMessage[]` — ordem cronológica crescente; no máximo `limit` mais recentes; conversa inexistente → `NotFoundError`.
  - `limit < 1` → `InvalidStateError` (caminho de produção usa 12).
- **Rationale**: Espelha o pedido (`create` / `append` / `lastMessages`) e os edge cases da spec.
- **Alternatives considered**: (a) `lastMessages` devolver vazio para id inexistente — mascara erros do cliente; (b) criar conversa implicitamente no append — viola FR-012.

## R3. Janela de 12 e composição do prompt

- **Decision**: Constante `HISTORY_WINDOW = 12`. Antes de `strategy.run`, carregar `lastMessages(id, 12)` e passar por função pura `composeChatPrompt(history, currentMessage) → string`. A estratégia **não** muda de assinatura: continua `run(input: string)`.
- **Rationale**: Spec pede “via composição”; evita refatorar ReAct / plan-and-execute / reflection; testes unitários da composição sem IO.
- **Formato do prompt composto** (texto estável para asserts):

  ```text
  Histórico da conversa:
  user: <content>
  assistant: <content>
  ...

  Mensagem atual:
  <currentMessage>
  ```

  Se `history` vazio, devolver só `currentMessage` (sem cabeçalhos), para o primeiro turn permanecer idêntico ao comportamento atual do chat.
- **Alternatives considered**: (a) estender `StrategyRunOptions` com array de mensagens — muda todas as estratégias; (b) API LangChain multi-message no HTTP — fora do contrato `ReasoningStrategy` atual.

## R4. Métrica `historyMessages`

- **Decision**: Estender `Metrics` com `historyMessages: number` (obrigatório nas respostas HTTP de sucesso). O handler define `historyMessages = history.length` **após** o load e **antes** do run; faz merge `{ ...result.metrics, historyMessages }` na resposta. Estratégias podem omitir o campo internamente.
- **Rationale**: Conta só histórico prévio (assumptions da spec); observabilidade sem alterar o núcleo de raciocínio.
- **Alternatives considered**: (a) campo só no envelope HTTP fora de `metrics` — diverge do pedido; (b) contar incluindo a mensagem atual — contradiz assumptions.

## R5. Fluxo do turn e persistência

- **Decision** (ordem):
  1. Validar body (Zod).
  2. Se sem `conversationId` → `create()`; se com id → verificar existência via `lastMessages(id, 12)` (ou `exists`); id desconhecido → `NotFoundError`.
  3. Compor prompt; `historyMessages = history.length`.
  4. `strategy.run(composed)` com timeout existente.
  5. Só em sucesso: `append(user, message)` depois `append(assistant, answer)`.
  6. Responder `200` com `answer`, `trace`, `metrics` (com `historyMessages`) e `conversationId`.
- **Rationale**: Falha da estratégia não polui o histórico; sucesso sem append coerente não devolve 200 (FR edge case).
- **Alternatives considered**: append do user antes do run — deixa órfãos em timeout/erro.

## R6. HTTP para id inexistente e validação

- **Decision**: `NotFoundError` → **404** `{ error: { code: "NOT_FOUND", message } }`. `conversationId` no Zod: `z.string().trim().min(1).optional()` (ou `.uuid()` se quisermos travar formato; preferir `min(1)` + ids gerados como UUID para não rejeitar ids já gravados em testes). String vazia / só espaços → 400 (issues Zod). Demais códigos 400/422/504 inalterados.
- **Rationale**: Spec pede 4xx acionável; 404 é o mapeamento natural de `NOT_FOUND` já existente em `errors.ts`. Hoje o handler mapeia domínio genérico para 500 — esta feature corrige o mapeamento de `NotFoundError`.
- **Alternatives considered**: (a) 422 — confunde com estratégia desconhecida; (b) 400 — mistura validação de schema com recurso ausente.

## R7. Fake vs `:memory:`

- **Decision**: `MemoryConversationStore` (Map em memória) para testes de `POST /chat` e asserts de composição/orquestração. `SqliteConversationStore` + `SqliteOpsStore(":memory:")` (mesmo `db`) para testes de persistência real (ordem, LIMIT, CHECK de role, sobrevivência na mesma conexão).
- **Rationale**: Constituição VII + FR-010/011; espelha ops store (mock para isolamento, SQLite para persistência).
- **Alternatives considered**: só SQLite nos testes de HTTP — mais lento e acopla borda ao SQL; só fake — não cobre DDL/CHECK.

## R8. Wiring de produção

- **Decision**: `createChatServer({ registry?, timeoutMs?, conversationStore? })`. Default: obter store a partir do `DatabaseSync` do `getDefaultOpsStore()` (ou factory síncrona que abre `SqliteOpsStore` e deriva `SqliteConversationStore`). `src/index.ts` injeta o store de conversa na composição.
- **Rationale**: DI já usada no chat; testes injetam fake sem tocar `./data/opspilot.db`.
- **Alternatives considered**: singleton global sem DI — dificulta testes do endpoint.
