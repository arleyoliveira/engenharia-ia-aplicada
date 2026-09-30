# Contract: `POST /chat` (conversa persistente)

**Date**: 2026-09-18 | **Spec**: [spec.md](spec.md) | **Extends**: `003-chat-endpoint` /contracts/chat-http.md

## Request

```http
POST /chat
Content-Type: application/json
```

```json
{
  "message": "O que combinamos sobre o checkout?",
  "strategy": "react",
  "reflect": false,
  "conversationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Campo | Obrigatório | Default | Descrição |
|---|---:|---|---|
| `message` | Sim | - | Solicitação textual, não vazia após trim. |
| `strategy` | Não | `react` | Nome registrado da estratégia. |
| `reflect` | Não | `false` | Ativa reflexão sobre a estratégia. |
| `conversationId` | Não | *(cria nova)* | Id opaco de conversa existente; omitir para criar. |

Schema Zod: objeto **strict** (campos extras rejeitados). `conversationId`, se presente, string trim com `min(1)`.

## Responses

### 200 OK

```json
{
  "answer": "Priorizamos a fila de pagamentos do checkout.",
  "trace": [{ "type": "answer", "content": "..." }],
  "metrics": {
    "llmCalls": 2,
    "latencyMs": 184,
    "historyMessages": 4
  },
  "conversationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Campo | Descrição |
|---|---|
| `answer` / `trace` | Inalterados em relação a `003-chat-endpoint`. |
| `metrics.llmCalls` / `latencyMs` | Inalterados. |
| `metrics.historyMessages` | Quantidade de mensagens de histórico injetadas no prompt (0..12); não inclui a mensagem atual. |
| `conversationId` | Sempre presente no sucesso: novo id se omitido na request; eco do id válido se informado. |

### 400 Bad Request

Corpo inválido / JSON malformado — mesmo formato de issues Zod de `003`. Inclui `conversationId` vazio ou só espaços.

```json
{
  "issues": [
    {
      "code": "too_small",
      "path": ["conversationId"],
      "message": "..."
    }
  ]
}
```

### 404 Not Found

`conversationId` informado mas inexistente no store.

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Conversa não encontrada: \"...\""
  }
}
```

Não cria conversa substituta.

### 422 Unprocessable Content

Estratégia desconhecida — inalterado.

```json
{
  "error": {
    "code": "UNKNOWN_STRATEGY",
    "message": "Estratégia desconhecida: \"foo\"."
  }
}
```

### 504 Gateway Timeout

Timeout 180s — inalterado (`CHAT_TIMEOUT`).

/** Fluxo append user antes do run (referência runChat do implement). */

1. Janela: até **12** mensagens mais recentes da conversa (`HISTORY_WINDOW`), carregadas **antes** do append da mensagem atual.
2. `strategy.run({ message, history })` — histórico tipado, não só string composta (ReAct usa mensagens role/content; plan-and-execute compõe texto).
3. Persistência: `append(user)` **antes** de `strategy.run`; `append(assistant)` **depois** do sucesso.
4. `historyMessages` = `history.length` no momento do load (não inclui a mensagem atual deste turn).

## Dependency injection

```typescript
export interface ChatServerDependencies {
  registry?: StrategyRegistry;
  timeoutMs?: number;
  conversationStore?: ConversationStore;
}
```

Sem `conversationStore` na composição de produção, o default usa a implementação SQLite sobre o mesmo `DatabaseSync` do ops store.

## ConversationStore (contrato interno)

```typescript
export type MessageRole = "user" | "assistant";

export interface ConversationMessage {
  id: number;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface ConversationStore {
  create(): string;
  append(
    conversationId: string,
    message: { role: MessageRole; content: string },
  ): void;
  lastMessages(conversationId: string, limit: number): ConversationMessage[];
}
```
