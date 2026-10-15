# Contract: Chat HTTP (impacto do orçamento)

**Date**: 2026-09-22 | **Spec**: [spec.md](../spec.md)

Extensão **comportamental** do `POST /chat`. Sem campos novos obrigatórios no request ou response.

## Request

Inalterado (Zod atual: `message`, `conversationId?`, `userId?`, `strategy?`, `reflect?`).

Configuração de tetos **não** vem no body — só via env `CONTEXT_BUDGET_*` no processo.

## Response `200` — métricas

Campos existentes; semântica atualizada:

| Campo | Semântica após 012 |
|-------|---------------------|
| `metrics.historyMessages` | Contagem de mensagens de histórico **após** orçamento da janela |
| `metrics.recalledMemories` | Contagem de fatos de memória **após** orçamento |
| `metrics.contextBreakdown.message` | `estimateTokens(message)` — mensagem intocável |
| `metrics.contextBreakdown.history` | Soma estimada do histórico **orçado** |
| `metrics.contextBreakdown.memories` | Soma estimada das memórias **orçadas** |
| `metrics.contextBreakdown.summary` | Estimativa do resumo **orçado** (0 se ausente) |
| `metrics.promptTokens` | Inalterado (usage real do modelo) |

## Códigos de erro

`400` / `404` / `422` / `504` / `UNKNOWN_STRATEGY` — inalterados. Orçamento **nunca** por si só causa erro HTTP.

## Estratégias

Qualquer `strategy` válida recebe o mesmo contexto orçado. Não há query/flag para “pular orçamento”.

## Observabilidade operacional

Para ensaio com tetos baixos:

```bash
CONTEXT_BUDGET_SUMMARY=20 \
CONTEXT_BUDGET_WINDOW=50 \
CONTEXT_BUDGET_MEMORIES=30 \
npm run dev
```

Esperado: `historyMessages` / `recalledMemories` / breakdown menores que o material bruto disponível na conversa/recall, quando os tetos forçam corte.
