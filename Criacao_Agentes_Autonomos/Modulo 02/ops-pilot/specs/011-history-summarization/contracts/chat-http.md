# Contract: `POST /chat` (histórico com pruning)

**Date**: 2026-09-22 | **Spec**: [spec.md](../spec.md) | **Extends**: `010-context-usage-metrics` /contracts/chat-http.md

## Request

Inalterado (`message`, `strategy?`, `reflect?`, `conversationId?`, `userId?`).

## Responses

### 200 OK

Envelope inalterado (`answer`, `trace`, `metrics`, `conversationId`). Mudanças observáveis:

| Campo | Mudança |
|-------|---------|
| `metrics.historyMessages` | Inteiro 0..**8** (janela crua; não inclui mensagem atual). |
| `metrics.contextBreakdown.history` | Estimativa só das até 8 mensagens cruas. |
| `metrics.contextBreakdown.summary` | `estimateTokens` do resumo injetado; `0` se não houver resumo. |
| `metrics.contextBreakdown.message` / `memories` | Inalterados na regra. |
| `trace` | Pode conter `{ "type": "summarize", "content": "..." }` **somente** no turn em que houve consolidação; ausente nos demais. |

Exemplo (turn de consolidação):

```json
{
  "answer": "...",
  "trace": [
    { "type": "summarize", "content": "Decisões: ... Fatos: ... Pendências: ..." },
    { "type": "thought", "content": "..." },
    { "type": "answer", "content": "..." }
  ],
  "metrics": {
    "llmCalls": 2,
    "latencyMs": 210,
    "historyMessages": 8,
    "recalledMemories": 0,
    "promptTokens": 900,
    "contextBreakdown": {
      "message": 12,
      "history": 80,
      "memories": 0,
      "summary": 148
    }
  },
  "conversationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Contexto montado (não é campo HTTP)

O prompt/mensagens do agente incluem, quando houver resumo:

```text
Resumo da conversa:
<summary vigente>

[Memórias relevantes: ...]
Histórico da conversa:
...
Mensagem atual:
...
```

### 400 / 404 / 422 / 504

Inalterados. Falha de sumarização/persistência no turn elegível → erro de domínio traduzido na borda (não 200).

## Comportamento de consolidação (observável)

1. Com ≤ 8 mensagens persistidas antes do turn: sem `summarize` no trace; sem exigência de resumo.
2. Quando um lote de 8 mensagens sai da janela desde o último cursor: exatamente um evento `summarize` naquele 200; turns seguintes reutilizam o resumo **sem** novo `summarize` até o próximo lote de 8.
3. `historyMessages` nunca excede 8.
