# Data Model: Orçamento de contexto por seção

**Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

## Constantes (padrões)

| Nome | Valor | Env override |
|------|-------|----------------|
| `DEFAULT_SECTION_BUDGETS.summary` | `200` | `CONTEXT_BUDGET_SUMMARY` |
| `DEFAULT_SECTION_BUDGETS.window` | `1200` | `CONTEXT_BUDGET_WINDOW` |
| `DEFAULT_SECTION_BUDGETS.memories` | `300` | `CONTEXT_BUDGET_MEMORIES` |

Unidade: tokens estimados via `estimateTokens` = `floor(chars / 4)`.

## Entidades

### SectionBudgets

```text
SectionBudgets = {
  summary: number   // inteiro ≥ 1
  window: number    // inteiro ≥ 1
  memories: number  // inteiro ≥ 1
}
```

- Sem teto para `system` / `message` (intocáveis).

### ContextBuilderInput

```text
ContextBuilderInput = {
  system?: string
  message: string
  summary?: string
  history: readonly { role: "user" | "assistant"; content: string }[]
  memories: readonly { fact: string; score: number }[]  // ranking: melhor primeiro
}
```

### BudgetedContext

```text
BudgetedContext = {
  system?: string                         // === input.system (intocado)
  message: string                         // === input.message (intocado)
  summary?: string                        // ausente se vazio após corte
  history: { role; content }[]            // subconjunto; mais recentes preservados
  memories: string[]                      // fatos sobreviventes (maior score)
}
```

### MemoryCandidate

```text
MemoryCandidate = { fact: string; score: number }
```

- Corte: menor `score` sai primeiro; empate → pior ranking (último entre empatados).

### HistoryMessage (janela)

```text
HistoryMessage = { role: "user" | "assistant"; content: string }
```

- Ordem: antiga → recente. Corte: remove do início.

## Regras de validação

| Campo / env | Regra |
|-------------|--------|
| `CONTEXT_BUDGET_*` | Inteiro finito `> 0` após trim; senão → padrão da seção |
| `message` | Sempre presente no output (= input) |
| `system` | Se presente no input, idêntico no output |
| `summary` orçado | `estimateTokens(text) ≤ budgets.summary` ou ausente |
| `history` orçado | soma `estimateTokens(content) ≤ budgets.window` |
| `memories` orçado | soma `estimateTokens(fact) ≤ budgets.memories` |
| Item individual (msg/fato) | Se `estimateTokens > teto` da seção → não entra |
| Prefixo de resumo | `maxLen = 4 * budget + 3`, depois ajustar até caber |

## Fluxo no turn (`runChat`)

```text
lastMessages(HISTORY_WINDOW=8)
  → summary (pruning 011)
  → recall → hits { fact, score }[]
  → resolveSectionBudgets(env)
  → buildBudgetedContext({ message, summary, history, memories: hits }, budgets)
  → strategy.run({ message, history, memories, summary } do BudgetedContext)
  → metrics: historyMessages / recalledMemories / contextBreakdown no orçado
```

## Relação com entidades existentes

| Existente | Impacto |
|-----------|---------|
| `ChatTurnInput` | Continua `{ message, history?, memories?: string[], summary? }` — já orçado |
| `HISTORY_WINDOW` (8) | Aplicada **antes** do builder |
| `contextBreakdown` | Calculado no material orçado |
| HTTP `/chat` | Sem campos novos de request/response além do efeito nas métricas de contagem/breakdown |

## Fora de escopo no modelo

- Orçamento global (soma de seções)
- Teto para system/message
- Persistência de “o que foi cortado”
- Mudança de `conversation_summaries` / recall store
