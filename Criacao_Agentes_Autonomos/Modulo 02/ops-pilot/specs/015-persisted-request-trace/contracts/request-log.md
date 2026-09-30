# Contract: Log JSON do pedido

**Date**: 2026-09-24 | **Spec**: [spec.md](../spec.md)

Escritor único: `createRequestLogger` em `src/obs/logger.ts`. Uma chamada escreve uma linha em UTF-8 terminada em `\n`. O objeto não é pretty-printed. O sink padrão é `process.stdout.write`. Testes injetam outro sink.

## Linha de evento (`kind: "trace"`)

Só no `POST /chat` que chegou a `200`, uma linha por elemento de `trace`, na mesma ordem, antes da linha de resumo.

```json
{"ts":"<iso-8601>","level":"info","kind":"trace","requestId":"<uuid>","seq":0,"type":"thought","node":"react"}
```

| Campo | Regra |
|-------|--------|
| `ts` | ISO-8601 do instante da escrita |
| `level` | sempre `"info"` |
| `kind` | sempre `"trace"` |
| `requestId` | o id da resposta |
| `seq` | índice no array, desde 0 |
| `type` | `event.type` |
| `node` | `event.node` ou `""` |

Nenhuma outra chave. Em particular ausentes: `content`, `args`, `steps`, `reason`, `tool`, `from`, `to`, texto da mensagem e texto da resposta.

Trace vazio: zero linhas `kind: "trace"`.

## Linha de resumo (`kind: "request"`)

Exatamente uma por `POST /chat`, sucesso ou erro, depois das linhas de evento quando elas existem.

```json
{"ts":"<iso-8601>","level":"info","kind":"request","requestId":"<uuid>","status":200,"metrics":{"llmCalls":1,"latencyMs":1}}
```

| Campo | Regra |
|-------|--------|
| `status` | status HTTP efetivo da resposta |
| `metrics` | presente só no `200`; o mesmo objeto de `metrics` do corpo |

Erro (incluindo falha de gravação): a linha não tem `metrics` nem payload.

`GET /requests/:id` não escreve linha.
