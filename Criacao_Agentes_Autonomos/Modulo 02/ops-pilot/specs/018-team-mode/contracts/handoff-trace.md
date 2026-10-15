# Contract: Evento `handoff` e "ver raciocínio"

**Date**: 2026-09-28 | **Spec**: [spec.md](../spec.md)

## Evento

```typescript
{
  type: "handoff";
  next: "analista" | "planejador" | "executor" | "fim";
  brief: string;
  node: "supervisor";
}
```

Há um `handoff` por decisão aceita do supervisor, na ordem das decisões, no máximo 8. O evento do papel vem depois do `handoff` que o nomeou. `fim` não é seguido de evento de papel.

Eventos do papel:

| Papel | Tipos que ele emite | `node` |
|-------|---------------------|--------|
| `analista` | `thought` (achados); `action` / `observation` se houve ferramenta de leitura | `analista` |
| `planejador` | `plan` com `steps` (linhas não vazias do plano) | `planejador` |
| `executor` | `action` / `observation` das tools de incidente | `executor` |

O `answer` final do modo (brief de `fim` ou mensagem de limite) é um evento `answer` com `node: "supervisor"`.

## formatTrace

```text
[handoff] <next> <brief>
```

As linhas já definidas para `thought`, `action`, `plan`, `route`, `answer` e `fallback` permanecem.

## ver raciocínio

`presentTrace` de um evento `handoff` devolve:

```text
lines: [
  { label: "next", value: <next> },
  { label: "brief", value: <brief> }
]
```

`node` continua metadado do evento, como nos outros tipos. O painel abre e fecha sem novo `POST`. Tipo desconhecido continua uma linha `evento` com o JSON.
