# Research: Trace persistido e logs JSON

**Date**: 2026-09-24 | **Spec**: [spec.md](spec.md)

## R1. Onde nasce o `requestId`

- **Decision**: Um middleware em `createChatServer`, registrado **antes** de `express.json()`, gera `randomUUID()` em `POST /chat` e guarda em `res.locals.requestId`. Nenhuma resposta desse verbo lê o header de entrada `X-Request-Id`. O corpo continua no `chatRequestSchema` estrito: `requestId` enviado pelo cliente segue `400`.
- **Rationale**: JSON inválido falha dentro do `express.json()`, antes do handler. Sem o middleware anterior, o `400` de corpo ilegível não teria id. Gerar no `runChat` deixaria `400` e `422` sem identificador.
- **Alternatives considered**: Honrar o header de entrada (a spec manda ignorar); gerar só no handler do `200` (quebra o erro de parse).

## R2. Onde ficam as tabelas

- **Decision**: `CREATE TABLE IF NOT EXISTS` de `requests` e `trace_events` no `initializeSchema` do `SqliteOpsStore`. `SqliteRequestTraceStore` recebe o `DatabaseSync` já aberto, no mesmo estilo de `SqliteConversationStore`. Não há FK para `conversations`: o teste HTTP pode usar `MemoryConversationStore` enquanto o trace vai para outro sqlite, e o projeto não liga `PRAGMA foreign_keys`.
- **Rationale**: Um arquivo (`OPSPILOT_DB`) e um schema. `:memory:` é por conexão; um segundo `DatabaseSync(":memory:")` seria outro banco e o GET não veria o POST.
- **Alternatives considered**: Métodos novos no `OpsStore` (mistura alerta/incidente com auditoria de chat); banco separado (foge da constituição VII).

## R3. Transação e “nada pela metade”

- **Decision**: `save` faz `BEGIN`, insere `requests`, serializa e insere cada `trace_events`, `COMMIT`. Qualquer exceção faz `ROLLBACK` e relança. O `JSON.stringify` do payload ocorre **dentro** da transação, depois do insert do pedido. O HTTP só responde `200` depois que `save` retorna. Se `save` lança, a resposta é `500` com `{ requestId, error: { code: "INTERNAL_ERROR", message } }` e a mensagem não inclui o erro do SQLite. Não há linhas de log de evento nesse `500`; há a linha de resumo com `status: 500`.
- **Rationale**: A spec exige atomicidade e proíbe `200` quando a gravação falha. Serializar dentro da transação dá um teste real de rollback (payload circular deixa zero linhas).
- **Alternatives considered**: Gravar sem transação e apagar o pedido no `catch` (janela com linha órfã); responder `200` e tratar o store como best-effort (contradiz a spec).

## R4. O que o GET devolve como trace

- **Decision**: `trace_events.payload_json` é o `JSON.stringify` do evento inteiro. `node` é coluna à parte (`event.node ?? ""`) para consulta, não para reconstruir o objeto. `findById` lê `ORDER BY position ASC` e faz `JSON.parse` de cada payload. O array resultante é o `trace` do GET e deve ser profundo-igual ao `trace` do `200`.
- **Rationale**: O evento tem variantes (`action.args`, `plan.steps`, `route.reason`, `fallback.from/to`). Reconstruir por colunas perderia campo. A coluna `node` cumpre o pedido de “node, payloads” sem ser a fonte do GET.
- **Alternatives considered**: Uma coluna por campo do evento (não cobre `args` livre); devolver `node` só da coluna e omitir o resto do payload.

## R5. Formato da linha de log

- **Decision**: `src/obs/logger.ts` exporta `createRequestLogger(sink?)`. O sink padrão é `process.stdout.write`. Cada chamada escreve exatamente uma linha (`JSON.stringify` + `\n`). Chaves fechadas:
  - evento de trace: `ts`, `level` (`"info"`), `kind` (`"trace"`), `requestId`, `seq`, `type`, `node`
  - resumo: `ts`, `level`, `kind` (`"request"`), `requestId`, `status`, e no `200` também `metrics` (o objeto numérico já devolvido no chat)
  Ordem no `200`: as N linhas `kind: "trace"` na ordem do array, depois uma linha `kind: "request"`. Erro: só a linha de resumo. Falha do sink depois do `save` não muda o `200` (o controller captura o erro do logger). `GET` não escreve linha.
- **Rationale**: A spec fixa “uma linha por evento, só metadados” e pede uma linha de resumo por `POST /chat`. Lista fechada de chaves torna o teste de “sem payload” objetivo: o texto distintivo do evento não aparece na saída, e chaves como `content`, `args`, `steps`, `reason`, `tool`, `from`, `to` não existem.
- **Alternatives considered**: Logar o evento inteiro e filtrar na leitura (vaza payload); uma linha só com o resumo (não atende “uma linha por evento”).

## R6. Quem injeta o store

- **Decision**: `getDefaultRequestTraceStore()` em `default-store.ts` reutiliza o `SqliteOpsStore` em cache (mesmo `OPSPILOT_DB`). `src/index.ts` passa esse store para `createChatServer`. Se o teste omite `requestTraceStore`, o servidor cria um `SqliteOpsStore(":memory:")` próprio daquela instância e um `SqliteRequestTraceStore` em cima dele. O logger default escreve no stdout; o teste que afirma as linhas injeta um sink.
- **Rationale**: Produção precisa sobreviver a restart no arquivo já usado pelas conversas. O default `:memory:` evita que `createChatServer()` nos testes atuais grave `./data/opspilot.db`, e ainda assim todo `200` fica consultável naquele app.
- **Alternatives considered**: Store opcional que não grava (o `200` de teste deixaria de cumprir a spec); sempre abrir `OPSPILOT_DB` no teste (sujeira no arquivo de desenvolvimento).

## R7. `GET /requests/:id`

- **Decision**: `id` com trim vazio ou que não seja UUID é `400` com `{ issues }` no formato Zod já usado no chat. UUID válido ausente é `404` `{ error: { code: "NOT_FOUND", message } }` via `NotFoundError`. O GET não gera outro `requestId` nem header `X-Request-Id`. Repetir o GET não regrava.
- **Rationale**: A spec separa id vazio (`400`) de id válido inexistente (`404`). UUID é o formato que o próprio servidor emite (`randomUUID`), então qualquer outra string é id inválido, não “pedido sumido”.
- **Alternatives considered**: Qualquer string desconhecida como `404` (aceitaria lixo como se fosse chave); `400` com `{ error }` em vez de `issues` (quebra o precedente da fronteira Zod).
