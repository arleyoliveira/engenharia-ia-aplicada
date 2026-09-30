# Quickstart: Conversa persistente no chat

Validação do contrato em [contracts/chat-http.md](contracts/chat-http.md). Modelo: [data-model.md](data-model.md).

## Pré-requisitos

- Node.js 22 LTS e dependências instaladas (`npm install`).
- Credenciais de modelo **não** são necessárias para os testes desta feature (estratégia fake + store fake / `:memory:`).
- Opcional: `.env` com `OPSPILOT_DB` apenas para o cenário manual com servidor real.

## Cenário 1 - Store SQLite em `:memory:` (obrigatório)

```bash
npm run test -- src/store/sqlite-conversation-store.test.ts
```

**Esperado**:

- `create` devolve id não vazio; `append` user/assistant; `lastMessages(id, N)` em ordem cronológica.
- Mais de N mensagens → resultado com length `N` (as mais recentes, ordem crescente no retorno).
- Id inexistente em `append` / `lastMessages` → `NotFoundError`.
- `limit < 1` → `InvalidStateError`.
- Usa o mesmo `DatabaseSync` de um `SqliteOpsStore(":memory:")` (schema com `conversations` + `messages`).

## Cenário 2 - Integração `POST /chat` com fake (obrigatório)

```bash
npm run test -- src/http/server.test.ts
```

**Esperado**:

- Sem `conversationId` → `200` com `conversationId` e `metrics.historyMessages === 0`; segundo POST com o id → `historyMessages >= 1` e mesmo id.
- `conversationId` inexistente → `404` com `error.code === "NOT_FOUND"`.
- `conversationId: "   "` → `400` com issues.
- Regressão: defaults `strategy`/`reflect`, `422` estratégia desconhecida, `504` timeout.
- Sem rede e sem criar `./data/opspilot.db`.

## Cenário 3 - Typecheck + suíte

```bash
npm run typecheck
npm run test
```

**Esperado**: verdes após a feature.

## Cenário 4 - Manual opcional (servidor + curl)

```bash
npm run dev
# ou: npx tsx --env-file-if-exists=.env src/index.ts
```

```bash
curl -s localhost:3000/chat -H 'content-type: application/json' \
  -d '{"message":"Liste alertas firing"}'
```

**Esperado**: JSON `200` com `conversationId` e `historyMessages: 0`.

```bash
curl -s localhost:3000/chat -H 'content-type: application/json' \
  -d '{"message":"E o que priorizar?","conversationId":"<id-anterior>"}'
```

**Esperado**: mesmo `conversationId`, `historyMessages >= 1` (após o primeiro turn ter persistido o par user/assistant).
