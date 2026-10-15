# Data Model: Conversa persistente no chat

**Date**: 2026-09-18 | **Spec**: [spec.md](spec.md)

## Entidades novas

### Conversation

```text
Conversation = {
  id: string          // UUID opaco, PK
  createdAt: string   // ISO / CURRENT_TIMESTAMP
}
```

- Criada por `ConversationStore.create()`.
- Não há listagem/exclusão nesta feature.

### ConversationMessage

```text
MessageRole = "user" | "assistant"

ConversationMessage = {
  id: number          // PK autoincrement (interno)
  conversationId: string
  role: MessageRole
  content: string     // texto não vazio na prática do append do chat
  createdAt: string   // ordenação estável
}
```

- `lastMessages(conversationId, limit)` devolve até `limit` registros mais recentes, **ordenados do mais antigo ao mais recente** entre os selecionados (cronologia de leitura no prompt).

### HistoryWindow

```text
HistoryWindow = {
  messages: ConversationMessage[]  // length 0..12
  historyMessages: number          // === messages.length
}
```

## Persistência SQLite (mesmo DB do OpsStore)

### Tabela `conversations`

| Coluna | Tipo | Restrições |
|--------|------|------------|
| `id` | TEXT | PRIMARY KEY |
| `created_at` | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP |

### Tabela `messages`

| Coluna | Tipo | Restrições |
|--------|------|------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `conversation_id` | TEXT | NOT NULL, FK → `conversations(id)` |
| `role` | TEXT | NOT NULL, CHECK IN (`user`, `assistant`) |
| `content` | TEXT | NOT NULL |
| `created_at` | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP |

Índice recomendado: `(conversation_id, id)` ou `(conversation_id, created_at, id)` para `lastMessages`.

DDL idempotente (`CREATE TABLE IF NOT EXISTS`) no `initializeSchema` do `SqliteOpsStore`.

## Contrato `ConversationStore`

```text
ConversationStore = {
  create(): string
  append(conversationId: string, message: { role: MessageRole, content: string }): void
  lastMessages(conversationId: string, limit: number): ConversationMessage[]
}
```

### Regras de validação

| Operação | Regra |
|----------|--------|
| `create` | Gera UUID; insere linha em `conversations`. |
| `append` | Conversa deve existir; `role` ∈ {user, assistant}; prepared statement. |
| `lastMessages` | Conversa deve existir; `limit >= 1` senão `InvalidStateError`; resultado length ≤ limit. |
| id desconhecido | `NotFoundError` (`NOT_FOUND`). |

### Implementações

| Impl | Uso |
|------|-----|
| `SqliteConversationStore` | Produção + testes `:memory:` (db compartilhado) |
| `MemoryConversationStore` | Testes de HTTP / orquestração |

## Tipos de borda (chat)

### ChatRequest (estendido)

```text
ChatRequest = {
  message: string           // trim, min 1
  strategy?: string         // default "react"
  reflect?: boolean         // default false
  conversationId?: string   // trim, min 1 se presente
}
```

### ChatResponse (estendido)

```text
ChatResponse = {
  answer: string
  trace: TraceEvent[]
  metrics: {
    llmCalls: number
    latencyMs: number
    historyMessages: number  // ≥ 0
  }
  conversationId: string
}
```

### Metrics (núcleo)

```text
Metrics = {
  llmCalls: number
  latencyMs: number
  historyMessages?: number  // preenchido na borda do chat
}
```

## Fluxo de estado (um turn)

```text
[sem conversationId]
  → create() → history=[] → compose(message) → run → append(user) → append(assistant) → 200

[com conversationId existente]
  → lastMessages(12) → compose(history, message) → run → append×2 → 200

[com conversationId inexistente]
  → NotFoundError → 404
```

## Relacionamentos

```text
Conversation 1 ── * ConversationMessage
SqliteOpsStore.db ── shared ── SqliteConversationStore
```

Entidades operacionais (`services`, `alerts`, `incidents`, `runbooks`) inalteradas; convivem no mesmo arquivo SQLite.
