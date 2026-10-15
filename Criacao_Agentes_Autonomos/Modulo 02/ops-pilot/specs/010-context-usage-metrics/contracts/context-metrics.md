# Contract: medição de contexto

**Date**: 2026-09-22 | **Spec**: [spec.md](../spec.md)

Módulo puro `src/context/tokens.ts`. Sem IO.

## `estimateTokens`

```text
estimateTokens(text: string): number
```

| Entrada | Resultado |
|---|---|
| `""` | `0` |
| comprimento 1..3 | `0` |
| comprimento `4k` | `k` |
| comprimento `4k+r` (`r` = 1..3) | `k` (resto descartado) |

## `estimateContextBreakdown`

```text
estimateContextBreakdown(input: {
  message: string
  history: readonly { content: string }[]
  memories: readonly string[]
}): { message: number; history: number; memories: number }
```

| Fonte | Cálculo |
|---|---|
| `message` | `estimateTokens(input.message)` |
| `history` | soma de `estimateTokens(entry.content)`; lista vazia → `0` |
| `memories` | soma de `estimateTokens(fact)`; lista vazia → `0` |

Não incluir rótulos de papel nem cabeçalhos de formatação.

## `promptTokensFromLlmEnd`

```text
promptTokensFromLlmEnd(output: unknown): number
```

Uma chamada de modelo, um inteiro ≥ 0. Ordem e exclusões em [data-model.md](../data-model.md) (`TurnPromptUsage`).

O callback em `src/agents/metrics.ts` (`createLlmCallCounter`) soma esse valor em cada `handleLLMEnd`. `handleLLMStart` continua só incrementando `calls`.

## Métricas nas estratégias

| Estratégia | `metrics.promptTokens` |
|---|---|
| `react` | `counter.promptTokens` ao final do `run` |
| `plan-and-execute` | idem (planner, executor, replanner compartilham o handler) |
| `withReflection` | soma dos `promptTokens` de cada `strategy.run` da base mais `promptTokens` do contador do crítico |

`runChat` faz `result.metrics.promptTokens ?? 0` e preenche `contextBreakdown` (este contrato de breakdown). Não lê usage direto.
