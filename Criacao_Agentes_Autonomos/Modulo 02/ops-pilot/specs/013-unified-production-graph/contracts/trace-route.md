# Contract: Evento `route` e campo `node`

**Date**: 2026-09-23 | **Spec**: [spec.md](../spec.md)

## Evento

```typescript
{
  type: "route";
  route: "react" | "plan-and-execute" | "reflection";
  reason: string;
  override: boolean;
  node: "roteador";
}
```

Há exatamente um evento `route` por turn bem-sucedido. Ele é o primeiro evento do trace, salvo um `summarize` imediatamente antes quando o turn consolidou histórico.

Override:

- `override: true`
- `reason === "estratégia informada pelo cliente"`
- `route` igual ao `strategy` do corpo

Sem override:

- `override: false`
- `route` e `reason` iguais ao que o `routeModel` devolveu (`reason` trimada, não vazia)

## Campo `node`

Todo elemento de `trace` no `200` tem `node` string não vazia. Regras de carimbo: [data-model.md](../data-model.md).

## formatTrace

Linha do evento `route`, sem o id do nó no texto:

```text
[route] <route> override=<true|false> <reason>
```

Exemplo:

```text
[route] plan-and-execute override=true estratégia informada pelo cliente
```

As linhas de `thought`, `action`, `observation`, `plan`, `critique`, `answer` e `summarize` permanecem no formato já testado.
