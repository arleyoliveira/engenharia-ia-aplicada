# Data Model: Sumarização de histórico (pruning)

**Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

## Constantes

| Nome | Valor | Uso |
|------|-------|-----|
| `HISTORY_WINDOW` | `8` | Mensagens cruas no prompt (`lastMessages`) |
| `PRUNE_BATCH_SIZE` | `8` | Tamanho do lote que dispara consolidação |
| `SUMMARY_TARGET_TOKENS` | `150` | Alvo aproximado do resumo vigente (`estimateTokens`) |

## Entidades

### ConversationSummary (vigente)

```text
ConversationSummary = {
  conversationId: string           // PK / FK → conversations.id
  text: string                     // resumo mesclado vigente (~150 tokens)
  coveredThroughMessageId: number  // último messages.id absorvido
  updatedAt: string                // ISO / CURRENT_TIMESTAMP
}
```

- No máximo **um** resumo por conversa (upsert).
- `coveredThroughMessageId = 0` semanticamente = nada coberto (linha ausente ≡ mesmo efeito).

### PrunedBatch

```text
PrunedBatch = ConversationMessage[8]  // exatamente 8, ordem cronológica crescente
```

- Seleção: mensagens com `coveredThroughMessageId < id < oldestRawWindow.id`, as 8 de menor `id`.

### HistoryWindow (atualizado)

```text
HistoryWindow = {
  messages: ConversationMessage[]  // length 0..8
  historyMessages: number          // === messages.length
}
```

### ChatTurnInput (estendido)

```text
ChatTurnInput = {
  message: string
  history?: ChatHistoryMessage[]   // 0..8
  memories?: string[]
  summary?: string                 // resumo vigente, se houver
}
```

### TraceEvent (estendido)

```text
TraceEvent |= { type: "summarize"; content: string }
```

### ContextBreakdown (estendido)

```text
ContextBreakdown = {
  message: number
  history: number    // só mensagens cruas
  memories: number
  summary: number    // estimateTokens(summary); 0 se ausente
}
```

## Persistência SQLite

### Tabela `conversation_summaries`

| Coluna | Tipo | Restrições |
|--------|------|------------|
| `conversation_id` | TEXT | PRIMARY KEY, FK → `conversations(id)` |
| `summary` | TEXT | NOT NULL |
| `covered_through_message_id` | INTEGER | NOT NULL, CHECK `>= 0` |
| `updated_at` | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP |

DDL idempotente no `ensureSchema` do `SqliteOpsStore` (junto de `conversations` / `messages`).

`messages` e `conversations` **inalteradas**.

## Extensão `ConversationStore`

```text
ConversationStore = {
  create(): string
  append(conversationId, { role, content }): void
  lastMessages(conversationId, limit): ConversationMessage[]
  getSummary(conversationId): ConversationSummary | null
  upsertSummary(conversationId, { text, coveredThroughMessageId }): void
  messagesBefore(
    conversationId,
    beforeIdExclusive: number,
    afterIdExclusive: number,
    limit: number
  ): ConversationMessage[]
}
```

### Regras

| Operação | Regra |
|----------|--------|
| `getSummary` | Conversa deve existir; sem linha → `null`. |
| `upsertSummary` | Conversa deve existir; `text` não vazio; `coveredThroughMessageId >= 0`; prepared upsert. |
| `messagesBefore` | `id > afterIdExclusive AND id < beforeIdExclusive`, `ORDER BY id ASC`, `LIMIT limit`; conversa inexistente → `NotFoundError`. |
| id desconhecido | `NotFoundError` (igual 007). |

### Implementações

| Impl | Uso |
|------|-----|
| `SqliteConversationStore` | Produção + testes `:memory:` |
| `MemoryConversationStore` | Testes de orquestração / HTTP |

## Fluxo de estado (um turn)

```text
load lastMessages(8) + getSummary
  → candidatos = messagesBefore(oldestWindowId, coveredId, 8+)
  → se candidatos.length >= 8:
        summarize(previous, batch[0..8])
        upsertSummary(text, batch[7].id)
        didSummarize = true
  → summaryText = novo || anterior
  → recall? → append(user) → strategy.run({ history, summary, ... })
  → append(assistant)
  → metrics: historyMessages, contextBreakdown.summary, ...
  → trace: didSummarize ? [summarize, ...trace] : trace
```

## Relacionamentos

```text
Conversation 1 ── * Message
Conversation 1 ── 0..1 ConversationSummary
ConversationSummary.coveredThroughMessageId ──> Message.id (cursor)
```
