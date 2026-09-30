# Data Model: Trace persistido e logs JSON

**Date**: 2026-09-24 | **Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md)

## Entidades

### ChatRequestRecord

```text
ChatRequestRecord = {
  requestId: string       // UUID, PK
  conversationId: string  // o mesmo do 200 de POST /chat
  createdAt: string       // ISO-8601 gerado no save
  metrics: Metrics        // objeto devolvido em metrics no 200
  trace: TraceEvent[]     // reconstruído; não é coluna de requests
}
```

`Metrics` e `TraceEvent` são os tipos já existentes em `src/agents/types.ts`. Esta feature não acrescenta campo de métrica nem variante de trace.

Não há estado de ciclo de vida. Ou o registro existe por inteiro, ou não existe. Não há update nem delete.

### TraceEventRecord

```text
TraceEventRecord = {
  requestId: string
  position: number        // 0 .. trace.length-1, único por pedido
  node: string            // event.node ?? ""
  payload: TraceEvent     // objeto completo daquela posição
}
```

Pertence a um `ChatRequestRecord`. A ordem de leitura é `position` ascendente.

## SQLite (mesmo arquivo do OpsStore)

DDL idempotente em `SqliteOpsStore.initializeSchema`.

### Tabela `requests`

| Coluna | Tipo | Restrições |
|--------|------|------------|
| `id` | TEXT | PRIMARY KEY (`requestId`) |
| `conversation_id` | TEXT | NOT NULL |
| `created_at` | TEXT | NOT NULL |
| `metrics_json` | TEXT | NOT NULL, JSON do objeto `metrics` |

Sem FK para `conversations`.

### Tabela `trace_events`

| Coluna | Tipo | Restrições |
|--------|------|------------|
| `request_id` | TEXT | NOT NULL, FK lógica → `requests(id)` |
| `position` | INTEGER | NOT NULL, CHECK ≥ 0 |
| `node` | TEXT | NOT NULL (string vazia se o evento não tiver `node`) |
| `payload_json` | TEXT | NOT NULL, JSON do `TraceEvent` |

PRIMARY KEY (`request_id`, `position`).

## Contrato `RequestTraceStore`

```text
RequestTraceStore = {
  save(input: {
    requestId: string
    conversationId: string
    metrics: Metrics
    trace: readonly TraceEvent[]
  }): void

  findById(requestId: string): ChatRequestRecord | null
}
```

Implementação: `SqliteRequestTraceStore` sobre um `DatabaseSync` cujo schema já foi inicializado.

### Regras

| Operação | Regra |
|----------|--------|
| `save` | Transação. Insere uma linha em `requests` e uma em `trace_events` por evento, `position` = índice. `created_at` = `new Date().toISOString()` no momento do save. `node` = `event.node ?? ""`. Payload serializado dentro da transação. |
| `save` com exceção | `ROLLBACK`. Quem chama vê a exceção. `findById` daquele id devolve `null` se nada tinha sido commitado. |
| `save` com `requestId` já existente | A transação falha na PK. O registro anterior permanece. |
| `save` com `trace` vazio | Só a linha de `requests`. |
| `findById` | `null` se não houver linha. Senão o registro com `trace` vindo de `payload_json` em ordem de `position`. Não escreve. |

Consulta sempre com statement preparado (`?`). Nenhum fragmento de SQL é montado com o id ou com o payload.
