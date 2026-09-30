# Data Model: Memória semântica por usuário

**Date**: 2026-09-18 | **Spec**: [spec.md](spec.md)

## Entidades

### Memory

```text
Memory = {
  id: string            // UUID opaco, PK
  userId: string        // escopo de isolamento
  fact: string          // texto não vazio (trim)
  embedding: Float32Array  // L2-normalizado, dim 384
  createdAt: string     // ISO / CURRENT_TIMESTAMP
}
```

### RecallHit

```text
RecallHit = {
  id: string
  fact: string
  score: number         // produto escalar ∈ [-1, 1]; filtro score ≥ 0.3
}
```

### EmbeddingPipeline

```text
Embedder = (text: string) => Promise<Float32Array>
```

- Singleton lazy: carrega `Xenova/all-MiniLM-L6-v2` na primeira chamada.
- Pooling `mean`, `normalize: true`.

## Persistência SQLite (mesmo DB do OpsStore)

### Tabela `memories`

| Coluna | Tipo | Restrições |
|--------|------|------------|
| `id` | TEXT | PRIMARY KEY |
| `user_id` | TEXT | NOT NULL |
| `fact` | TEXT | NOT NULL |
| `embedding` | BLOB | NOT NULL |
| `created_at` | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP |

Índice: `CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories (user_id)`.

DDL idempotente no `initializeSchema` do `SqliteOpsStore`.

### Encoding BLOB

- Escrita: bytes little-endian do `Float32Array` (384 × 4 bytes).
- Leitura: reconstruir `Float32Array` com o mesmo layout.

## Contrato `MemoryStore`

```text
MemoryStore = {
  remember(userId: string, fact: string): Promise<string | null>
  recall(userId: string, query: string): Promise<RecallHit[]>
  forget(userId: string, id: string): Promise<boolean>
}
```

### Regras

| Operação | Regra |
|----------|--------|
| `remember` | Trim; rejeitar vazio. Embed; se algum fato do user tem score ≥ **0,92**, retornar `null` sem insert. Senão insert UUID e retornar `id`. |
| `recall` | Embed query; ranquear só linhas do `userId`; filtrar score ≥ **0,3**; top **3**; empate: `created_at` DESC, `id` DESC. |
| `forget` | `DELETE` onde `id` e `user_id` batem; `true` se changes > 0, senão `false`. |
| Escopo | Nunca ler/apagar memórias de outro `userId`. |

### Constantes

| Nome | Valor |
|------|------:|
| `DEDUP_THRESHOLD` | 0.92 |
| `RECALL_MIN_SCORE` | 0.3 |
| `RECALL_TOP_K` | 3 |

### Implementações

| Impl | Uso |
|------|-----|
| `SqliteMemoryStore` | Produção + testes `:memory:` / semânticos |
| Fake in-memory | Testes de `runChat` / HTTP (sem modelo) |

## Tipos de borda (chat)

### ChatRequest (estendido)

```text
ChatRequest = {
  message: string
  strategy?: string
  reflect?: boolean
  conversationId?: string
  userId?: string          // NOVO — trim, min 1 se presente
}
```

### ChatTurnInput (estendido)

```text
ChatTurnInput = {
  message: string
  history?: readonly ChatHistoryMessage[]
  memories?: readonly string[]   // NOVO — fatos do recall
}
```

### Metrics (estendido)

```text
Metrics = {
  llmCalls: number
  latencyMs: number
  historyMessages?: number
  recalledMemories?: number     // NOVO — length do recall injetado
}
```

## Fluxo de estado

```text
remember(userId, fact)
  → embed(fact)
  → scan memórias do user
  → se maxScore ≥ 0.92 → null
  → else INSERT → id

recall(userId, query)
  → embed(query)
  → scores · filter ≥ 0.3 · sort · take 3 → RecallHit[]

runChat(+ userId)
  → [se userId] recall(message) → memories
  → strategy.run({ message, history, memories })
  → metrics.recalledMemories = memories.length
```

## Relacionamentos

```text
UserMemoryScope (userId) 1 ── * Memory
SqliteOpsStore.db ── shared ── SqliteMemoryStore
ChatTurn ── uses ── RecallHit.fact[] (via composição)
```

Entidades operacionais e de conversa (`conversations` / `messages`) inalteradas; convivem no mesmo arquivo SQLite.
