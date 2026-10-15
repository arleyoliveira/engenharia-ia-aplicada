# Contract: `POST /chat` (memória semântica)

**Date**: 2026-09-18 | **Spec**: [spec.md](spec.md) | **Extends**: `007-persistent-conversation` /contracts/chat-http.md

## Request

```http
POST /chat
Content-Type: application/json
```

```json
{
  "message": "qual idioma das notificações?",
  "strategy": "react",
  "reflect": false,
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "ops-alice"
}
```

| Campo | Obrigatório | Default | Descrição |
|---|---:|---|---|
| `message` | Sim | - | Solicitação textual, não vazia após trim. |
| `strategy` | Não | `react` | Nome registrado da estratégia. |
| `reflect` | Não | `false` | Ativa reflexão. |
| `conversationId` | Não | *(cria nova)* | Id de conversa existente. |
| `userId` | Não | *(sem memória)* | Escopo de memória semântica; se presente, dispara `recall` e injeta no prompt. |

Schema Zod: objeto **strict**. `userId`, se presente, string trim com `min(1)`.

## Responses

### 200 OK

```json
{
  "answer": "...",
  "trace": [{ "type": "answer", "content": "..." }],
  "metrics": {
    "llmCalls": 2,
    "latencyMs": 184,
    "historyMessages": 2,
    "recalledMemories": 1
  },
  "conversationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Campo | Descrição |
|---|---|
| `metrics.historyMessages` | Inalterado (0..12). |
| `metrics.recalledMemories` | Quantidade de fatos do `recall` injetados neste turn (`0` se sem `userId` ou recall vazio). |
| Demais campos | Inalterados em relação a `007`. |

### 400 / 404 / 422 / 504

Inalterados. `userId: "   "` → **400** com issues Zod.

## Composição do prompt

Quando `memories.length > 0`, o texto composto inclui bloco estável **antes** do histórico:

```text
Memórias relevantes:
- <fact1>
- <fact2>

Histórico da conversa:
...
Mensagem atual:
<message>
```

Sem memórias: omitir o bloco (compatível com 007).

## Dependency injection

```typescript
export interface ChatServerDependencies {
  registry?: StrategyRegistry;
  timeoutMs?: number;
  conversationStore?: ConversationStore;
  memoryStore?: MemoryStore; // NOVO
}

export interface ChatInput {
  message: string;
  conversationId?: string;
  userId?: string; // NOVO
}

export interface RunChatDeps {
  conversation: ConversationStore;
  strategy: ReasoningStrategy;
  memory?: MemoryStore; // NOVO — opcional
}
```

Ordem no turn (estende 007):

1. Resolver `conversationId` + carregar histórico (janela 12).
2. Se `userId` e `memory` → `recall(userId, message)` → `memories`.
3. `append(user)`; `strategy.run({ message, history, memories })`.
4. `append(assistant)`; responder com `recalledMemories: memories.length`.
