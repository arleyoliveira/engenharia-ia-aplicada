# Quickstart: Sumarização de histórico (pruning)

Validação dos contratos em [contracts/](contracts/). Modelo: [data-model.md](data-model.md).

## Pré-requisitos

- Node.js 22 LTS e `npm install`.
- Credenciais de modelo **não** necessárias para os cenários obrigatórios (sumarizador fake + store fake / `:memory:`).

## Cenário 1 - Store SQLite `:memory:` (obrigatório)

```bash
npm run test -- src/store/sqlite-conversation-store.test.ts
```

**Esperado**:

- DDL inclui `conversation_summaries`.
- `upsertSummary` + `getSummary` round-trip (`text`, `coveredThroughMessageId`).
- `messagesBefore` respeita `after` / `before` / `limit` e ordem crescente.
- Id inexistente → `NotFoundError`.

## Cenário 2 - Pruning + `runChat` com fake (obrigatório)

```bash
npm run test -- src/services/history-pruning.test.ts src/services/run-chat.test.ts
```

**Esperado**:

- Com ≤ 8 msgs: sem consolidação, sem evento `summarize`.
- Após 16 msgs (8 fora da janela): um turn consolida → resumo persistido, `summary` no input da estratégia, `trace[0].type === "summarize"` (ou presente no array).
- Turns seguintes sem novo lote de 8: **zero** novas chamadas ao sumarizador / zero novos `summarize`; mesmo texto de resumo no contexto.
- Segundo lote (ex. 24 msgs): nova mescla; `getSummary` reflete merge com o anterior.
- `historyMessages === 8` quando há overflow; `contextBreakdown.summary > 0` com resumo.

## Cenário 3 - HTTP com fake (obrigatório)

```bash
npm run test -- src/http/server.test.ts
```

**Esperado**:

- Regressão 007/008/010: `conversationId`, 404/400/422/504, `promptTokens` / breakdown.
- Com store + summarizer fake e conversa longa o bastante: `historyMessages <= 8`; turn de consolidação traz evento `summarize`.
- Sem rede e sem criar `./data/opspilot.db`.

## Cenário 4 - Typecheck + suíte

```bash
npm run typecheck
npm run test
```

**Esperado**: verdes após a feature.

## Cenário 5 - Manual opcional

```bash
npm run dev
```

Gerar > 16 turnos no mesmo `conversationId` (ou usar `scripts/conversa-longa.sh` se aplicável) e inspecionar um `200` cujo `trace` contenha `summarize` e `metrics.historyMessages` ≤ 8 com `contextBreakdown.summary` > 0.
