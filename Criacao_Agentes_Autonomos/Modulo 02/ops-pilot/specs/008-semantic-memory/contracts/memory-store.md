# Contract: `MemoryStore` (memória semântica)

**Date**: 2026-09-18 | **Spec**: [spec.md](spec.md) | **Model**: [data-model.md](../data-model.md)

## Interface

```typescript
export const DEDUP_THRESHOLD = 0.92;
export const RECALL_MIN_SCORE = 0.3;
export const RECALL_TOP_K = 3;

export interface RecallHit {
  id: string;
  fact: string;
  score: number;
}

export interface MemoryStore {
  remember(userId: string, fact: string): Promise<string | null>;
  recall(userId: string, query: string): Promise<RecallHit[]>;
  forget(userId: string, id: string): Promise<boolean>;
}

export type Embedder = (text: string) => Promise<Float32Array>;
```

## Operações

### `remember(userId, fact)`

| | |
|---|---|
| Pré-condição | `userId` e `fact` não vazios após trim |
| Efeito | Insere memória com embedding, ou noop se similaridade ≥ `DEDUP_THRESHOLD` com alguma memória do mesmo user |
| Retorno | `id` (string) se inseriu; `null` se deduplicado |
| Erro | domínio se inputs inválidos |

### `recall(userId, query)`

| | |
|---|---|
| Pré-condição | `userId` e `query` não vazios após trim |
| Efeito | Nenhum (somente leitura) |
| Retorno | Até `RECALL_TOP_K` hits com `score >= RECALL_MIN_SCORE`, ordem decrescente de score |
| Isolamento | Apenas linhas com o mesmo `user_id` |

### `forget(userId, id)`

| | |
|---|---|
| Efeito | Remove linha se `id` + `user_id` coincidem |
| Retorno | `true` se removeu; `false` caso contrário (noop) |

## Embeddings (`src/memory/embeddings.ts`)

```typescript
/** Lazy singleton: carrega Xenova/all-MiniLM-L6-v2 na 1ª chamada. */
export function embed(text: string): Promise<Float32Array>;
```

- Pipeline: `feature-extraction`, `pooling: "mean"`, `normalize: true`.
- Falha de carga → erro de domínio (mensagem de borda, sem stack de IO).

## Persistência

Tabela `memories` — ver [data-model.md](../data-model.md). `SqliteMemoryStore(db: DatabaseSync, embedder?: Embedder)`.

## Fora de escopo deste contrato

- Endpoints HTTP `POST /memories`, tools do agente para remember/forget.
- Autenticação de `userId`.
