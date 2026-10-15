# Contract: Chat HTTP (request id)

**Date**: 2026-09-24 | **Spec**: [spec.md](../spec.md)

`POST /chat`. O corpo da **requisição** não muda. A resposta ganha `requestId`.

## Request

Inalterado: `message`, `strategy` opcional, `reflect`, `conversationId`, `userId`. Schema estrito.

| Entrada | Efeito |
|---------|--------|
| Header `X-Request-Id` | Ignorado. Não é ecoado. |
| Campo `requestId` no JSON | `400`, como qualquer campo extra |

## Identificador

Gerado no servidor com `randomUUID()` antes do parse do corpo, inclusive quando o JSON é inválido. O mesmo valor vai no header de resposta `X-Request-Id` e no campo `requestId` do corpo.

## Response `200`

```json
{
  "requestId": "<uuid>",
  "conversationId": "<uuid>",
  "answer": "...",
  "trace": [],
  "metrics": {}
}
```

`answer`, `trace` e `metrics` continuam com o significado atual. Este `200` só sai depois que o pedido e o trace foram gravados ([data-model.md](../data-model.md)). Em seguida o processo escreve as linhas de [request-log.md](request-log.md): uma por evento, depois o resumo com `status` 200.

## Erros

Todos levam `requestId` e `X-Request-Id`. Nenhum grava `requests` nem `trace_events`. Cada um escreve só a linha de resumo.

| Condição | Status | Corpo |
|----------|--------|--------|
| JSON inválido, schema Zod (campo extra, `strategy` vazia, `reflect` não booleano) | `400` | `{ requestId, issues }` |
| `strategy` fora das rotas | `422` | `{ requestId, error: { code: "UNKNOWN_STRATEGY", message } }` |
| Conversa inexistente | `404` | `{ requestId, error: { code: "NOT_FOUND", message } }` |
| Saída inválida do modelo / erro inesperado | `500` | `{ requestId, error: { code, message } }` |
| Gravação do trace falhou depois do turn bem-sucedido | `500` | `{ requestId, error: { code: "INTERNAL_ERROR", message } }` sem detalhe de SQL |
| Modelo indisponível | `503` | `{ requestId, error: { code: "MODEL_UNAVAILABLE", message } }` |
| Timeout de borda | `504` | `{ requestId, error: { code: "CHAT_TIMEOUT", message } }` |

Códigos e mensagens já existentes permanecem; `requestId` é o único acréscimo.
