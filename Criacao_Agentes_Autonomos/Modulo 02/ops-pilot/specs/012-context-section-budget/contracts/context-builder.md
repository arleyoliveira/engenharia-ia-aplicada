# Contract: ContextBuilder (orçamento por seção)

**Date**: 2026-09-22 | **Spec**: [spec.md](../spec.md) | **Model**: [data-model.md](../data-model.md)

Módulo puro `src/context/context-builder.ts`. Sem IO na função de build. Resolução de env é leitura de mapa string→string (sem dotenv).

## Constantes

```text
DEFAULT_SECTION_BUDGETS = {
  summary: 200,
  window: 1200,
  memories: 300,
}
```

## `resolveSectionBudgets`

```text
resolveSectionBudgets(env?: Record<string, string | undefined>): SectionBudgets
```

| Env | Campo | Default se ausente/inválido |
|-----|--------|------------------------------|
| `CONTEXT_BUDGET_SUMMARY` | `summary` | `200` |
| `CONTEXT_BUDGET_WINDOW` | `window` | `1200` |
| `CONTEXT_BUDGET_MEMORIES` | `memories` | `300` |

**Inválido**: não parseia como inteiro finito, ou valor `≤ 0`.

## `buildBudgetedContext`

```text
buildBudgetedContext(
  input: ContextBuilderInput,
  budgets: SectionBudgets,
): BudgetedContext
```

### Seções intocáveis

| Seção | Regra |
|-------|--------|
| `system` | Se `input.system` definido, output idêntico; nunca truncar |
| `message` | Output === `input.message`; nunca truncar |

### Seções cortáveis

| Seção | Política quando `estimateTokens` excede o teto |
|-------|-----------------------------------------------|
| `summary` | Prefixo até `estimateTokens(text) ≤ budgets.summary` |
| `window` (`history`) | Remove mensagens mais antigas (índice 0) até caber |
| `memories` | Remove menor `score` (empate → pior ranking) até caber |

Estimativa por item: só `content` / `fact` (sem rótulo de papel). Soma dos itens mantidos ≤ teto da seção.

### Item maior que o teto

Mensagem ou fato com `estimateTokens > teto` da respectiva seção **não entra**. Resumo é a única seção que parte texto (prefixo).

## Garantias de teste (tetos baixos)

Com `budgets` explícitos baixos e fixtures conhecidas:

1. System + message intactos mesmo com summary/window/memories forçados a cortar.
2. Histórico `[old, mid, new]` com teto que só cabe `new` → output history = `[new]`.
3. Memórias scores altos→baixos com teto apertado → sobrevivem as de maior score.
4. Resumo longo → `estimateTokens(output.summary) ≤ budgets.summary`.
5. `resolveSectionBudgets({})` === defaults; env `"0"` / `"abc"` → default.

## Relação com formatação

Este contrato **não** define o texto final do prompt. Formatação permanece em `composeChatPrompt` / `toAgentMessages`, consumindo o `BudgetedContext` já convertido em `ChatTurnInput`.
