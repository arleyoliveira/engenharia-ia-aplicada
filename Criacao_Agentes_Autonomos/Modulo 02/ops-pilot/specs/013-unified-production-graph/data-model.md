# Data Model: Grafo unificado de produção

**Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

## Constantes

| Nome | Valor |
|------|--------|
| `PRODUCTION_ROUTES` | `react`, `plan-and-execute`, `reflection` |
| `OVERRIDE_REASON` | `estratégia informada pelo cliente` |
| Nós do grafo | `contexto`, `roteador`, `react`, `plan-and-execute`, `reflection`, `resposta` |

## Entidades

### ProductionRoute

Uma de `PRODUCTION_ROUTES`. É o único valor legal de `ChatRequest.strategy` (quando presente) e de `RouteDecision.route`.

### RouteDecision

```text
RouteDecision = {
  route: ProductionRoute
  reason: string          // não vazia; override usa OVERRIDE_REASON
  override: boolean
}
```

- `override: false` somente quando `strategy` foi omitida e o modelo do roteador respondeu.
- `override: true` somente quando o cliente enviou `strategy` válida. Nesse caso o modelo do roteador não roda.

### ProductionGraphInput

Material que `runChat` entrega ao grafo (ainda sem orçamento):

```text
ProductionGraphInput = {
  message: string
  history: readonly { role: "user" | "assistant"; content: string }[]
  memories: readonly { fact: string; score: number }[]
  summary?: string
  summarizeContent?: string   // presente só se este turn consolidou; o nó contexto emite o evento
  budgets: SectionBudgets
  strategy?: ProductionRoute  // ausente = roteador; presente = override já validado na borda
  reflect: boolean
  tools?: readonly unknown[]
}
```

### ProductionGraphState (estado do StateGraph)

Além do input:

```text
budgeted: { message, history, memories: string[], summary? , breakdown }
decision?: RouteDecision
answer: string
trace: TraceEvent[]          // reducer concatena o incremento de cada nó
metrics: { llmCalls, latencyMs, promptTokens, historyMessages?, recalledMemories?, contextBreakdown? }
visited: string[]            // ids dos nós, para o teste de ordem; não sai no HTTP
```

### Transições

```text
contexto
  → grava budgeted via buildContext
  → se summarizeContent: append { type: "summarize", content, node: "contexto" }
  → visited += "contexto"

roteador
  → se strategy definida: decision = { route: strategy, reason: OVERRIDE_REASON, override: true }
       e routeModel.invoke NÃO é chamado
  → senão: routeModel.invoke([{ role: "system", content: ROUTER_PROMPT }, { role: "user", content: budgeted.message }])
       reflect true  → route ∈ { react, plan-and-execute }
       reflect false → route ∈ PRODUCTION_ROUTES
       inválido → ModelOutputError (não há aresta de fallback)
  → append evento route (node "roteador")
  → visited += "roteador"

estratégia (exatamente uma)
  → run da estratégia da rota, com ChatTurnInput orçado e tools
  → reflect true e rota ≠ reflection: withReflection em volta dessa base
  → rota reflection: a estratégia registrada nesse id (produção = withReflection(react))
  → stampTraceNode no trace da estratégia
  → visited += id da rota

resposta
  → answer = answer da estratégia (sem evento answer novo)
  → metrics agregadas (R6)
  → visited += "resposta"
  → END
```

Não há transição de `roteador` para mais de um nó de estratégia no mesmo turn.

### TraceEvent (delta desta feature)

Variante nova, `node` obrigatório:

```text
{ type: "route"; route: ProductionRoute; reason: string; override: boolean; node: "roteador" }
```

Variantes existentes (`thought`, `action`, `observation`, `plan`, `critique`, `answer`, `summarize`) ganham `node?`. No trace que sai do nó `resposta` e no HTTP `200`, `node` está sempre preenchido:

| Origem | `node` |
|--------|--------|
| `summarize` emitido no turn | `contexto` |
| evento `route` | `roteador` |
| evento que não é `critique`, rota `react` ou `plan-and-execute` | o id dessa rota |
| evento que não é `critique`, rota `reflection` | `react` (base sob a camada) |
| `critique` | `reflection` |

O nó `resposta` não aparece como `node` de evento.

### ChatRequest.strategy

```text
ausente        → RouteDecision.override = false
string válida  → override, grafo roda
"" / espaços / tipo errado → 400 (Zod), grafo não roda
outro nome     → 422 UNKNOWN_STRATEGY, grafo não roda
```

`reflect` continua booleano, default `false`. Não substitui `strategy`.
