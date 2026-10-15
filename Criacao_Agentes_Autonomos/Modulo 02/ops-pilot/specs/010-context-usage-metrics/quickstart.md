# Quickstart: Medição de contexto do chat

Validação: [contracts/context-metrics.md](contracts/context-metrics.md), [contracts/chat-http.md](contracts/chat-http.md). Modelo: [data-model.md](data-model.md).

## Pré-requisitos

- Node.js 22 LTS e `npm install`.
- Credenciais de LLM **não** são necessárias. Os testes usam estratégia fake e fixtures de `handleLLMEnd`.
- O ensaio ao vivo de `scripts/conversa-longa.sh` (30 turnos) é opcional e exige servidor com modelo.

## Cenário 1 - Estimativa e parser de usage (obrigatório)

```bash
npm run test -- src/context/tokens.test.ts
```

**Esperado**:

- `estimateTokens("") === 0`, comprimento &lt; 4 → `0`, `floor` no resto (ex.: 5 caracteres → 1).
- Breakdown: cada fonte bate com a soma dos pisos; histórico e memórias vazios → `0`.
- Parser: `llmOutput.tokenUsage.promptTokens` vence; não soma de novo `usage_metadata` da mesma chamada; sem usage → `0`; `estimatedTokenUsage` ignorado.

## Cenário 2 - Callback e chat (obrigatório)

```bash
npm run test -- src/agents/metrics.test.ts
npm run test -- src/services/run-chat.test.ts
npm run test -- src/http/server.test.ts
npm run test -- src/agents/reflection.test.ts
```

**Esperado**:

- Duas `handleLLMEnd` somam `promptTokens`; `handleLLMStart` não altera tokens.
- `runChat` / `POST /chat` com fake sem usage: `metrics.promptTokens === 0` e `contextBreakdown` coerente com a mensagem (e com histórico/memórias quando existirem).
- Fake que reporta `promptTokens` → o `200` repassa esse inteiro.
- Reflexão soma os `promptTokens` da base; tokens do crítico entram quando o fake chama `handleLLMEnd`.
- Regressão: `conversationId`, `historyMessages`, `recalledMemories`, 400/404/422/504.

## Cenário 3 - Typecheck + suíte

```bash
npm run typecheck
npm run test
```

**Esperado**: verdes após a feature.

## Cenário 4 - Script (estático; ao vivo opcional)

Conferir que `scripts/conversa-longa.sh` ainda imprime, por turno, o valor de `.metrics.promptTokens` com fallback `n/a`. Não exige os 30 turnos na suíte.

Ao vivo, com o servidor no ar:

```bash
bash scripts/conversa-longa.sh
```

**Esperado**: uma linha por turno com `promptTokens=<inteiro>` (ou `n/a` se a resposta não trouxer o campo). O turno não falha só porque o campo veio ausente.
