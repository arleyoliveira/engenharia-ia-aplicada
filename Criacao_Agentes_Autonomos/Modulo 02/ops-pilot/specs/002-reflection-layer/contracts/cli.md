# Contract: CLI da Arena (Evolução com Reflection)

**Date**: 2026-09-11 | **Spec**: [spec.md](../spec.md)

## Mapeamento de Estratégias na CLI

A CLI `src/arena.ts` passa a suportar os seguintes identificadores de estratégias na flag `--strategies`:

| Identificador | Estratégia Base | Decorador | Descrição |
|---|---|---|---|
| `react` | ReAct (`createReactAgent`) | N/A | Estratégia ReAct pura. |
| `plan-and-execute` | Plan-and-Execute (Grafo) | N/A | Estratégia Plan-and-Execute pura. |
| `reflect:react` / `reflec:react` | ReAct | `withReflection(reactStrategy)` | ReAct com crítica e auto-correção reflexiva. |
| `reflect:plan-and-execute` / `reflec:plan-and-execute` | Plan-and-Execute | `withReflection(planAndExecuteStrategy)` | Plan-and-Execute com crítica e auto-correção reflexiva. |

## Formato de Saída na Arena

Para cada estratégia executada, a saída segue o padrão estabelecido no núcleo de raciocínio, exibindo os novos eventos de crítica no trace:

```text
=== reflect:react ===
Answer: Foram abertos os incidentes para os serviços api-gateway e billing, e o incidente de api-gateway foi resolvido com sucesso.
Trace:
  [action] list_alerts({"status":"firing"})
  [observation] {"alerts":[{"id":6,"service":"api-gateway",...},{"id":8,"service":"billing",...}]}
  [action] open_incident({"service":"api-gateway","severity":"medium","title":"Latência p95 acima de 2s"})
  [observation] {"incident":{"id":12,"title":"Latência p95 acima de 2s",...}}
  [critique] [APROVADO] A resposta está alinhada com as observações do alerta e reflete a abertura e resolução solicitadas.
  [answer] Foram abertos os incidentes para os serviços api-gateway e billing, e o incidente de api-gateway foi resolvido com sucesso.
Metrics: llmCalls=4 latencyMs=3240
```
