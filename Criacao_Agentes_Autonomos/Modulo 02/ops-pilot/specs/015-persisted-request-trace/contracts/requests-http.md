# Contract: GET /requests/:id

**Date**: 2026-09-24 | **Spec**: [spec.md](../spec.md)

Leitura do pedido gravado por um `POST /chat` `200`. Não cria, não altera e não escreve log.

## Request

`GET /requests/:id`

`id` é trimado. UUID no formato que `randomUUID()` emite.

## Response `200`

```json
{
  "requestId": "<uuid>",
  "conversationId": "<uuid>",
  "createdAt": "<iso-8601>",
  "metrics": {},
  "trace": []
}
```

- `metrics` é o objeto gravado no `200` do chat.
- `trace[i]` é profundo-igual ao `trace[i]` daquele chat, para todo `i`.
- A ordem é a posição persistida (`0` primeiro).
- Turn com trace vazio devolve `"trace": []`.

Não há header `X-Request-Id` nesta resposta. O `requestId` do corpo é o da URL, não um id novo.

## Erros

| Condição | Status | Corpo |
|----------|--------|--------|
| `id` vazio, só espaços, ou não-UUID | `400` | `{ issues }` Zod |
| UUID válido sem registro (chat que falhou, ou id nunca usado) | `404` | `{ error: { code: "NOT_FOUND", message } }` |

O `404` não insere linha. Um segundo GET do mesmo id `200` devolve o mesmo `trace` e as mesmas métricas.
