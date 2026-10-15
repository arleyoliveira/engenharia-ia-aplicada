# Quickstart: Orçamento de contexto por seção

Validação dos contratos em [contracts/](contracts/). Modelo: [data-model.md](data-model.md).

## Pré-requisitos

- Node.js 22 LTS e `npm install`.
- Credenciais de modelo **não** necessárias para os cenários obrigatórios.

## Cenário 1 - Builder unitário (obrigatório)

```bash
npm run test -- src/context/context-builder.test.ts
```

**Esperado**:

- Defaults `200` / `1200` / `300` quando env ausente.
- Env inválido (`"0"`, `"abc"`) cai no padrão.
- System e message intactos sob tetos baixos.
- Janela: remove mais antigas; sobrevivem as mais recentes.
- Memórias: remove menor score (empate → pior ranking).
- Resumo: `estimateTokens(summary) ≤ teto` após corte.
- Sem rede.

## Cenário 2 - `runChat` com material acima do teto (obrigatório)

```bash
npm run test -- src/services/run-chat.test.ts
```

**Esperado**:

- Com budgets baixos injetados (ou env de teste isolado): `strategy` recebe history/memories/summary já cortados.
- `metrics.historyMessages` / `recalledMemories` / `contextBreakdown` batem com o orçado (não com o bruto).
- System prompts internos das estratégias não são tocados pelo builder.
- Regressão 011: janela ≤ 8 antes do orçamento; resumo/pruning seguem válidos.

## Cenário 3 - HTTP regressão (obrigatório)

```bash
npm run test -- src/http/server.test.ts
```

**Esperado**:

- Contratos 007/008/010/011: `conversationId`, memórias, `promptTokens` / breakdown, `historyMessages`, códigos de erro.
- Sem rede e sem criar `./data/opspilot.db` por causa destes testes.

## Cenário 4 - Typecheck + suíte

```bash
npm run typecheck
npm run test
```

**Esperado**: verdes após a feature.

## Cenário 5 - Manual opcional (tetos baixos)

```bash
CONTEXT_BUDGET_SUMMARY=20 \
CONTEXT_BUDGET_WINDOW=40 \
CONTEXT_BUDGET_MEMORIES=25 \
npm run dev
```

Enviar turns com histórico longo e `userId` com várias memórias; inspecionar `metrics.historyMessages`, `recalledMemories` e `contextBreakdown` menores que o material bruto disponível.
