# Quickstart: Memória semântica por usuário

Validação: [contracts/memory-store.md](contracts/memory-store.md), [contracts/chat-http.md](contracts/chat-http.md). Modelo: [data-model.md](data-model.md).

## Pré-requisitos

- Node.js 22 LTS e `npm install` (inclui `@huggingface/transformers`).
- Credenciais de LLM **não** são necessárias para os testes desta feature (estratégia fake + MemoryStore fake / embedder local).
- A **primeira** execução do teste semântico pode baixar/cachear `Xenova/all-MiniLM-L6-v2` (rede só para o modelo; depois usa cache).
- Em macOS Intel (darwin/x64), o projeto fixa `onnxruntime-node@1.23.0` via `overrides` (versões ≥1.24 omitem o binário x64).

## Cenário 1 - Store + recall semântico (obrigatório)

```bash
npm run test -- src/memory-store.test.ts
```

**Esperado**:

- `remember` + `recall` com consulta **sem palavras em comum** devolve o fato (score ≥ 0,3, top ≤ 3).
- Segundo `remember` quase-duplicado (sim ≥ 0,92) retorna `null` e não duplica linha.
- `forget` remove; `recall` deixa de devolver o fato.
- Isolamento: memórias do user B não aparecem no recall de A.
- Usa `SqliteOpsStore(":memory:")` + mesmo `DatabaseSync` (tabela `memories`).

## Cenário 2 - `runChat` / `POST /chat` com fake (obrigatório)

```bash
npm run test -- src/services/run-chat.test.ts
npm run test -- src/http/server.test.ts
```

**Esperado**:

- Com `userId` + fake que devolve fatos → prompt/estratégia recebe memórias; `metrics.recalledMemories` = N.
- Sem `userId` → `recalledMemories === 0` (ou omitido de forma coerente com o contrato) e sem chamada de recall.
- `userId: "   "` → `400` issues.
- Regressão 007: `conversationId`, `historyMessages`, 404/422/504.

## Cenário 3 - Typecheck + suíte

```bash
npm run typecheck
npm run test
```

**Esperado**: verdes após a feature.

## Cenário 4 - Manual opcional

Popular memória via script/REPL de teste (não há HTTP de `remember` nesta feature), depois:

```bash
npm run dev
```

```bash
curl -s localhost:3000/chat -H 'content-type: application/json' \
  -d '{"message":"qual idioma das notificações?","userId":"ops-alice"}'
```

**Esperado**: `200` com `recalledMemories >= 1` se houver fato semanticamente relacionado gravado para `ops-alice`.
