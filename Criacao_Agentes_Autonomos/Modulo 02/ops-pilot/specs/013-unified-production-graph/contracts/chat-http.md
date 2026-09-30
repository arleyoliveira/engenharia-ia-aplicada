# Contract: Chat HTTP (grafo unificado)

**Date**: 2026-09-23 | **Spec**: [spec.md](../spec.md)

`POST /chat`. O corpo continua estrito. Mudança: `strategy` não tem mais default.

## Request

| Campo | Regra |
|-------|--------|
| `message` | string trimada, mínimo 1 (inalterado) |
| `strategy` | opcional. Se presente: string trimada, mínimo 1, e um de `react`, `plan-and-execute`, `reflection` |
| `reflect` | booleano, default `false` (inalterado) |
| `conversationId` | opcional (inalterado) |
| `userId` | opcional (inalterado) |

Omitir `strategy` não seleciona `react`. O roteador decide, e o trace traz `override: false`.

Enviar `strategy` válida não chama o modelo do roteador. O trace traz `override: true`.

## Response `200`

Formato inalterado: `{ conversationId, answer, trace, metrics }`.

- `answer` é o da estratégia escolhida (um só).
- `trace` obedece a [trace-route.md](trace-route.md).
- `metrics.llmCalls` inclui a chamada do roteador quando ela existiu.
- `metrics.historyMessages`, `recalledMemories` e `contextBreakdown` continuam refletindo o contexto orçado (012).

## Erros

| Condição | Status | Corpo |
|----------|--------|--------|
| JSON inválido, `strategy` vazia, `reflect` não booleano | `400` | `{ issues }` Zod, como hoje |
| `strategy` fora das três rotas | `422` | `{ error: { code: "UNKNOWN_STRATEGY", message } }` e nenhum nó de estratégia roda |
| Saída inválida do roteador | `500` | `toBoundaryMessage` com `MODEL_OUTPUT_ERROR` |
| Timeout 180s, conversa inexistente | `504` / `404` | inalterados |

`UNKNOWN_STRATEGY` deixa de depender do registry da arena. A lista é `PRODUCTION_ROUTES`.

## Fora deste contrato

Arena e CLI seguem invocando `ReasoningStrategy` direto. Não passam pelo grafo e não emitem evento `route`.
