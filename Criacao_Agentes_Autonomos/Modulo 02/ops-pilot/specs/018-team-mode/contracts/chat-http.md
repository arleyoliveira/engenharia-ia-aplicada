# Contract: Rota `team` no chat

**Date**: 2026-09-28 | **Spec**: [spec.md](../spec.md)

`POST /chat` não ganha campo. `strategy` continua string opcional, trimada, não vazia.

| Corpo | Resultado |
|-------|-----------|
| `strategy` omitida e o roteador devolve `team` | `200`. Evento `route` com `route: "team"`, `override: false`, `node: "roteador"`. Só a strategy `team` corre. |
| `strategy: "team"` | `200`. Modelo do roteador não é chamado. `route: "team"`, `override: true`, `reason` igual a `estratégia informada pelo cliente`. |
| `strategy` fora de `react`, `planExecute`, `reflect`, `team` | `422` `UNKNOWN_STRATEGY`. Nenhuma strategy corre. |
| `strategy: ""` ou só espaços | `400` com `issues`, como hoje. |

O prompt de sistema do roteador inclui a linha:

```text
| team | o pedido precisa ler a situação, propor um plano e agir em incidente, com papéis separados |
```

As linhas `react`, `planExecute` e `reflect` permanecem.

`reflect: true` com `strategy` omitida continua recusando rota fora de `react` e `planExecute` (`team` inclusive). `strategy: "team"` com `reflect: true` roda o modo equipe sem a camada de reflexão.

O corpo `200` continua `{ answer, trace, metrics }`. O `trace` pode conter `handoff`. Não há tabela nova no SQLite: o trace do pedido segue o `save` já existente.
