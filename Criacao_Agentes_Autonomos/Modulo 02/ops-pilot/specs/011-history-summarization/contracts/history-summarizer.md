# Contract: HistorySummarizer

**Date**: 2026-09-22 | **Spec**: [spec.md](../spec.md)

## Interface

```ts
type SummarizeInput = {
  previous?: string;
  batch: Array<{ role: "user" | "assistant"; content: string }>;
};

interface HistorySummarizer {
  summarize(input: SummarizeInput): Promise<string>;
}
```

## Semântica

| Entrada | Comportamento |
|---------|----------------|
| `batch` | Exatamente as mensagens do lote podado (produção: 8). Ordem cronológica. |
| `previous` ausente / vazio | Sumarizar só o lote. |
| `previous` presente | **Mesclar** com o lote: preservar decisões, fatos e pendências de ambos; um único texto vigente. |
| Retorno | String não vazia; alvo ~`SUMMARY_TARGET_TOKENS` (150) medido com `estimateTokens` (`floor(chars/4)`). |

## Fake (testes)

- Determinístico, sem rede.
- Inclui marcadores estáveis assertáveis (ex. trechos do batch e, se `previous` existir, indício de mescla).
- Se o batch trouxer sinais explícitos de decisão/fato/pendência nos testes, o fake os ecoa no texto.
- `estimateTokens(result)` dentro da faixa de tolerância acordada nos testes (ex. 120..180).

## Produção

- Uma chamada de modelo (mesmo stack OpenRouter/LangChain do agente).
- Prompt instrui: mesclar `previous` + batch; preservar decisões, fatos, pendências; ~150 tokens; português operacional.
- Falha de modelo/rede → rejeitar a Promise (propagada por `runChat` no turn elegível).

## DI

```ts
// RunChatDeps
summarizer?: HistorySummarizer;
```

Ausente: `runChat` não consolida (só janela crua) — útil em testes que não exercitam pruning. Produção injeta a impl real.
