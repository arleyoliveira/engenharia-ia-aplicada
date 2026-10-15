# Contract: Modo equipe

**Date**: 2026-09-28 | **Spec**: [spec.md](../spec.md)

## Estratégia

`teamStrategy.name === "team"`. `run(input, options?)` devolve `StrategyResult`. O `input` é o mesmo material orçado que as outras estratégias recebem (`message`, `history`, `memories`, `summary`). `options.tools`, quando vier, é a lista do turno (pode incluir `forget_preference`). Sem `options.tools`, a estratégia usa `createDefaultOpsTools()` e em seguida filtra.

Dependências injetáveis, todas opcionais:

```text
TeamDeps = {
  supervisor?: { invoke(messages): Promise<{ next: string; brief: string; promptTokens?: number }> }
  roles?: {
    analista?: RoleRunner
    planejador?: RoleRunner
    executor?: RoleRunner
  }
}
```

Sem `supervisor`, produção chama `createModel().withStructuredOutput`. Sem um `roles[papel]`, produção usa o runner padrão desse papel.

## Prompt do supervisor

A primeira mensagem é `system` e contém os três ids de papel e a palavra `fim`. A segunda é `user` e contém a mensagem do plantonista e o JSON do blackboard (achados, plano, ações, recados).

## Runner padrão

```text
RoleContext = {
  message: string
  brief: string
  blackboard: Blackboard
  tools: readonly { name: string; invoke(args: unknown): Promise<unknown> }[]
}
```

- `analista`: `tools` é a allowlist de leitura. No máximo uma leva de `tool_call` e, se houve chamada, uma segunda invocação do modelo para o texto dos achados. Sem chamada, o texto da primeira resposta são os achados.
- `planejador`: `tools` é `[]`. Uma saída estruturada `{ plan: string }` não vazia. Sem `bindTools`.
- `executor`: `tools` é só `open_incident` e `resolve_incident`. No máximo uma leva de `tool_call`. Cada chamada executa `invoke` no objeto dessa lista. Nome ausente dessa lista lança `ModelOutputError` e não consulta a lista original do turno.

O grafo ignora campo de escrita que não seja o do papel: retorno de analista não substitui `plan`; retorno de planejador não acrescenta `actions`.

## Teto

Constante `8`. Sequência com supervisor fake que sempre devolve um papel: exatamente 8 eventos `handoff`, o oitavo papel roda, a `answer` é a mensagem de limite. Supervisor que devolve `fim` na posição 8: a `answer` é o `brief` e a mensagem de limite não aparece.

## Erros

`next` fora do enum ou `brief` vazio depois do trim: `ModelOutputError`, zero execuções de papel nessa decisão. `ModelUnavailableError` do supervisor ou de um papel propaga sem escolher outro papel.
