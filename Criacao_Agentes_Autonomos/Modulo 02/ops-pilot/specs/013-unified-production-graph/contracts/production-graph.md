# Contract: Grafo de produção

**Date**: 2026-09-23 | **Spec**: [spec.md](../spec.md)

Módulo `src/agents/production-graph.ts`. Modelo: [data-model.md](../data-model.md).

## API

```typescript
export const PRODUCTION_ROUTES = ["react", "plan-and-execute", "reflection"] as const;
export type ProductionRoute = (typeof PRODUCTION_ROUTES)[number];

export const OVERRIDE_REASON = "estratégia informada pelo cliente";

/** Sistema do roteador. Inclui a tabela markdown das três rotas. */
export const ROUTER_PROMPT: string;

export function stampTraceNode(
  events: readonly TraceEvent[],
  base: "react" | "plan-and-execute",
): TraceEvent[];

export interface RouteModel {
  invoke(
    messages: readonly { role: string; content: string }[],
  ): Promise<{ route: string; reason: string }>;
}

export interface ProductionGraphDeps {
  strategies: Record<ProductionRoute, ReasoningStrategy>;
  /** Ausente em produção → createModel().withStructuredOutput. Presente em teste. */
  routeModel?: RouteModel;
  /** Repassado a withReflection quando reflect envolve a base. */
  critic?: CriticDependencies;
}

export function runProductionGraph(
  input: ProductionGraphInput,
  deps?: ProductionGraphDeps,
): Promise<StrategyResult & { visited: readonly string[] }>;
```

`visited` existe para o teste de ordem. `runChat` não o repassa no JSON HTTP.

## Ordem

Todo invoke bem-sucedido visita, nesta ordem:

1. `contexto`
2. `roteador`
3. exatamente o id em `decision.route`
4. `resposta`

Os outros dois ids de estratégia não entram em `visited` e o `run` deles não é chamado.

## Prompt

`ROUTER_PROMPT` contém esta tabela (texto estável, assertável):

| route | quando usar |
|-------|-------------|
| react | consulta ou ação operacional resolvível com ferramentas em poucas iterações |
| plan-and-execute | pedido com vários passos dependentes que precisa de um plano explícito |
| reflection | pedido em que a resposta precisa de revisão crítica antes de ser entregue |

Sem override, `routeModel.invoke` recebe uma mensagem `system` cujo `content` é `ROUTER_PROMPT` e uma `user` com a mensagem orçada.

## Falha do roteador

`ModelOutputError` se o invoke lançar, devolver vazio, `route` fora do enum daquele turn, ou `reason` em branco depois do trim. Nenhum `strategy.run` ocorre depois disso.
