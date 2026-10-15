# Contract: Chat HTTP (decisão e CORS)

**Date**: 2026-09-28 | **Spec**: [spec.md](../spec.md) | **Extends**: `015-persisted-request-trace` /contracts/chat-http.md

`POST /chat` e `OPTIONS /chat`. O turno de mensagem não muda. Entram o corpo de decisão, o CORS e o `202` que a war room consome (este processo não o emite).

## Mensagem

Inalterado: `{ message, strategy?, reflect?, conversationId?, userId? }`, schema estrito. `decision` neste corpo é `400`.

## Decisão

```json
{ "conversationId": "<id>", "decision": "approve" }
```

`decision` é `approve` ou `deny`. `conversationId` é obrigatório e não vazio. Sem `message` e sem outro campo.

| Corpo | Status |
| --- | --- |
| Decisão válida e conversa existente | `200` |
| `decision` inválida, sem `conversationId`, ou misturada com `message` | `400` `{ requestId, issues }` |
| `conversationId` desconhecido | `404` `{ requestId, error: { code: "NOT_FOUND", message } }` |

O `200` de decisão:

```json
{
  "requestId": "<uuid>",
  "conversationId": "<o mesmo id>",
  "answer": "Aprovado.",
  "trace": [{ "type": "answer", "content": "Aprovado.", "node": "decisao" }],
  "metrics": { "llmCalls": 0, "latencyMs": 0 }
}
```

`deny` usa `"Negado."` no `answer` e no `content`. O header `X-Request-Id` repete `requestId`. O pedido é gravado como qualquer `200`. Não há chamada de modelo.

## 202 consumido pela sala

Este servidor não responde `202`. O fake da war room pode responder:

```json
{
  "requestId": "<id>",
  "conversationId": "<id>",
  "pendingAction": { "summary": "Abrir incidente no billing" },
  "trace": []
}
```

`trace` é opcional. `pendingAction.summary` vazio ou ausente faz a sala usar `Ação aguardando decisão`.

## CORS

Só em `/chat`, e só quando a requisição tem `Origin`.

| Header de resposta | Valor |
| --- | --- |
| `Access-Control-Allow-Origin` | o `Origin` recebido |
| `Vary` | `Origin` |
| `Access-Control-Allow-Methods` | `POST` na resposta do `OPTIONS` |
| `Access-Control-Allow-Headers` | `Content-Type` na resposta do `OPTIONS` |

`OPTIONS /chat` com `Origin` e `Access-Control-Request-Method: POST` responde `204` sem corpo e sem `requestId`. Não se envia `Access-Control-Allow-Credentials`. Os mesmos `Allow-Origin` e `Vary` vão no `POST`, inclusive em `400`, `404` e no `200`.
