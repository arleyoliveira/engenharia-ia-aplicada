# Contract: Fábrica resiliente de modelo

**Date**: 2026-09-23 | **Spec**: [spec.md](../spec.md)

## Configuração

| Variável | Obrigatória | Efeito |
|----------|-------------|--------|
| `OPENROUTER_API_KEY` | sim | `ConfigError` se ausente/branca (inalterado) |
| `OPENROUTER_MODEL` | sim | modelo primário; `ConfigError` se ausente/branca |
| `OPENROUTER_MODEL_FALLBACK` | não | reserva; ausente, vazia ou só espaços → sem fallback |

Documentar a reserva em `.env.example` com valor vazio. Não versionar `.env`.

## `createModel()`

- Lê o ambiente na hora da chamada (sem dotenv), como hoje.
- Primário e reserva: mesma chave, `baseURL` `https://openrouter.ai/api/v1`, `temperature: 0`.
- Cada uso (`invoke`, `bindTools`, `withStructuredOutput`) produz uma cadeia nova:
  1. aplica a configuração no `ChatOpenAI` do primário;
  2. `withRetry({ stopAfterAttempt: 3 })`;
  3. se houver reserva, `withFallbacks([reserva])`, com a mesma configuração e **sem** retry;
  4. a reserva só registra `{ type: "fallback", from, to }` depois de responder;
  5. se a cadeia lançar, a fachada lança `ModelUnavailableError` e não a exceção crua do provedor.

Não há caminho de produção que invoque o primário sem o passo 2. Call sites atuais continuam chamando `createModel()` — a fachada absorve `bindTools` / `withStructuredOutput` / `invoke`.

## Composição testável

Função pura de cadeia (nome no código pode ser `createResilientRunnable`) aceita runnables fakes:

| Primário | Reserva | Resultado |
|----------|---------|-----------|
| falha, falha, sucesso | não chamada | sucesso, 0 fallbacks |
| 3 falhas | sucesso | sucesso, 1 evento `from`/`to` |
| 3 falhas | falha | `ModelUnavailableError` |
| 3 falhas | ausente | `ModelUnavailableError`, reserva não construída |

A reserva não é chamada na tentativa 1 ou 2.

## Coletor

- `runChat` abre o coletor antes do sumarizador e do grafo.
- Estratégia/arena: se não houver coletor, a própria `strategy.run` pode abrir um para o trace dela; se `runChat` já abriu, o interno não substitui o externo.
- Aprendizado (009) roda fora do coletor. Falha lá não é `503`.

## Trace

`TraceEvent` ganha:

```ts
{ type: "fallback"; from: string; to: string; node?: string }
```

`formatTrace` imprime esse tipo sem exigir `content`. `summarizeMetrics` inclui `fallbacks=<n>` quando o campo está definido.
