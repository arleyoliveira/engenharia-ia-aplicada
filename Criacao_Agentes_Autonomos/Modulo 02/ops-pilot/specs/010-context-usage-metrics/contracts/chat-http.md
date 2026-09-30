# Contract: `POST /chat` (métricas de contexto)

**Date**: 2026-09-22 | **Spec**: [spec.md](../spec.md) | **Extends**: `008-semantic-memory` /contracts/chat-http.md

## Request

Inalterado. Sem campos novos. Schema Zod strict de `007`/`008` (`message`, `strategy?`, `reflect?`, `conversationId?`, `userId?`).

## Responses

### 200 OK

```json
{
  "answer": "...",
  "trace": [{ "type": "answer", "content": "..." }],
  "metrics": {
    "llmCalls": 2,
    "latencyMs": 184,
    "historyMessages": 2,
    "recalledMemories": 1,
    "promptTokens": 840,
    "contextBreakdown": {
      "message": 11,
      "history": 96,
      "memories": 8
    }
  },
  "conversationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Campo | Descrição |
|---|---|
| `metrics.promptTokens` | Inteiro ≥ 0. Soma dos tokens de **entrada** reportados pelo runtime em todas as chamadas de modelo que produzem esta resposta (estratégia, ferramentas, crítico se `reflect=true`). Chamada sem usage contribui `0`. Se nenhuma reportar, o campo é `0`. |
| `metrics.contextBreakdown.message` | `floor(caracteres da mensagem atual / 4)`. |
| `metrics.contextBreakdown.history` | Soma de `floor(caracteres do content / 4)` das mensagens de histórico injetadas (0..12). Não inclui a mensagem atual. |
| `metrics.contextBreakdown.memories` | Soma de `floor(caracteres do fato / 4)` dos fatos de recall injetados. `0` sem `userId` ou sem recall. |
| `metrics.llmCalls`, `latencyMs`, `historyMessages`, `recalledMemories` | Inalterados. |
| Demais campos | Inalterados (`answer`, `trace`, `conversationId`). |

`promptTokens` e a soma de `contextBreakdown` **não** precisam ser iguais.

O refletor de aprendizado (009) não altera estes números: roda depois do sucesso e não entra na soma.

### 400 / 404 / 422 / 504

Inalterados. Corpo de erro sem `metrics`.

## Leitura pelo script

`scripts/conversa-longa.sh` lê, por turno:

```text
.metrics.promptTokens // "n/a"
```

Campo numérico → a linha contém `promptTokens=<inteiro>`. Campo ausente → `promptTokens=n/a` e o turno segue se o resto da resposta for válido. Não mudar esse fallback.

## Dependency injection

Sem deps novas em `createChatServer`. O breakdown é calculado em `runChat` a partir de mensagem, histórico e recall. O usage chega pelas estratégias que já recebem o callback de LLM.
