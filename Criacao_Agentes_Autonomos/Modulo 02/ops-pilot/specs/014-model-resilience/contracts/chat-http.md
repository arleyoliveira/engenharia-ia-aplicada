# Contract: `POST /chat` (resiliência de modelo)

**Date**: 2026-09-23 | **Spec**: [spec.md](../spec.md) | **Extends**: `010-context-usage-metrics` /contracts/chat-http.md

## Request

Inalterado. Sem campo novo. A reserva não vem no body.

## 200 OK

Campos existentes permanecem. Acrescenta-se:

```json
{
  "trace": [
    { "type": "route", "route": "react", "reason": "...", "override": false, "node": "roteador" },
    { "type": "fallback", "from": "openai/gpt-4o-mini", "to": "openai/gpt-4o-mini-2024-07-18" }
  ],
  "metrics": {
    "llmCalls": 2,
    "latencyMs": 184,
    "promptTokens": 840,
    "fallbacks": 1
  }
}
```

| Campo | Regra |
|-------|--------|
| `metrics.fallbacks` | Inteiro ≥ 0, sempre presente. Quantas chamadas de modelo do turn a reserva atendeu. |
| `trace[]` `type: "fallback"` | Um por atendimento da reserva, no final do trace, na ordem em que ocorreram. `from` = primário, `to` = reserva. Quantidade igual a `metrics.fallbacks`. |
| `metrics.llmCalls` | Inalterado: cada início de chamada conta, inclusive tentativas que falharam. |

Turn em que o primário se recupera no retry: `fallbacks` é `0` e não há evento `fallback`.

O script `conversa-longa.sh` não precisa imprimir `fallbacks`.

## 503 Service Unavailable

Cadeia esgotada (primário nas 3 tentativas e reserva falha ou não existe), em qualquer chamada do turn que produz a resposta (sumarizador, roteador, estratégia, crítico):

```json
{
  "error": {
    "code": "MODEL_UNAVAILABLE",
    "message": "O modelo de linguagem está indisponível."
  }
}
```

Sem `answer`, `trace` ou `metrics`. Sem stack e sem mensagem crua do provedor.

## Códigos que não mudam

| Status | Quando |
|--------|--------|
| `400` / `422` | validação Zod / estratégia desconhecida |
| `404` | conversa inexistente |
| `504` | `ChatTimeoutError` |
| `500` | `INTERNAL_ERROR` e outros erros de domínio que já caíam nesse status (`ModelOutputError`, etc.) |

`ConfigError` (chave ou modelo primário ausentes) não vira `503`.

O roteador não pode converter `ModelUnavailableError` em `ModelOutputError` nem disparar de novo a cadeia.

## Arena / CLI

A mesma falha total sai como erro de domínio (`toBoundaryMessage`), exit não-zero, sem bloco `Answer:`.
