# Contract: ConversationStore — resumo e lote podado

**Date**: 2026-09-22 | **Spec**: [spec.md](../spec.md) | **Extends**: `007-persistent-conversation` ConversationStore

## Métodos novos

### `getSummary(conversationId: string): ConversationSummary | null`

```ts
type ConversationSummary = {
  conversationId: string;
  text: string;
  coveredThroughMessageId: number;
  updatedAt: string;
};
```

- Conversa inexistente → `NotFoundError`.
- Sem linha em `conversation_summaries` → `null`.

### `upsertSummary(conversationId: string, input: { text: string; coveredThroughMessageId: number }): void`

- Substitui o resumo vigente da conversa (INSERT OR REPLACE / UPDATE).
- `text` trimado não vazio; `coveredThroughMessageId >= 0`.
- Conversa inexistente → `NotFoundError`.
- Statements preparados apenas.

### `messagesBefore(conversationId, beforeIdExclusive, afterIdExclusive, limit): ConversationMessage[]`

```sql
-- semântica
SELECT ... FROM messages
WHERE conversation_id = ?
  AND id > :afterIdExclusive
  AND id < :beforeIdExclusive
ORDER BY id ASC
LIMIT :limit
```

- `limit < 1` → `InvalidStateError`.
- Conversa inexistente → `NotFoundError`.
- Retorno em ordem cronológica crescente; length ≤ `limit`.

## Métodos existentes

`create` / `append` / `lastMessages` **inalterados** na assinatura. `lastMessages` em produção usa `HISTORY_WINDOW = 8`.

## Tabela

Ver [data-model.md](../data-model.md) — `conversation_summaries`.
