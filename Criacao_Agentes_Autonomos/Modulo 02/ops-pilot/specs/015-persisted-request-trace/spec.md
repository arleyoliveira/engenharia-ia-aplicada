# Feature Specification: Trace persistido e logs JSON

**Feature Branch**: `015-persisted-request-trace`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "Trace persistido + logs JSON: /chat com requestId no corpo e no header X-Request-Id; SQLite com requests (métricas) e trace_events (node, payloads); src/obs/logger.ts com 1 linha JSON por evento, só metadados; GET /requests/:id devolve o registro e o trace ordenado."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cada chat tem um identificador de correlação (Priority: P1)

O plantonista chama `POST /chat`. Toda resposta que o servidor produz traz o mesmo identificador de pedido no corpo JSON e no header `X-Request-Id`. O identificador é gerado pelo servidor, único por chamada, e não vem do cliente.

**Why this priority**: Sem um id estável, log, banco e consulta posterior não se encontram. É o elo das outras histórias e já entrega valor sozinho na resposta do chat.

**Independent Test**: Chamar `POST /chat` (sucesso e erro de validação) e comparar o `requestId` do corpo com o header `X-Request-Id`. Duas chamadas seguidas produzem ids diferentes. O corpo da requisição continua sem campo `requestId`.

**Acceptance Scenarios**:

1. **Given** um `POST /chat` que conclui com `200`, **When** o cliente lê a resposta, **Then** o corpo tem `requestId` string não vazia e o header `X-Request-Id` tem exatamente o mesmo valor.
2. **Given** um `POST /chat` rejeitado (`400`, `422`) ou que falha depois de aceito (`404`, `500`, `503`, `504`), **When** o cliente lê a resposta, **Then** o mesmo `requestId` aparece no corpo e em `X-Request-Id`.
3. **Given** dois `POST /chat` distintos, **When** o cliente compara os identificadores, **Then** eles são diferentes.
4. **Given** o cliente envia `X-Request-Id` na requisição ou tenta incluir `requestId` no corpo, **When** o servidor responde, **Then** o id devolvido é o gerado pelo servidor (o header de entrada é ignorado) e um corpo com campo extra continua `400` pelo schema estrito já existente.

---

### User Story 2 - O turn bem-sucedido fica gravado com métricas e trace (Priority: P1)

Depois de um chat `200`, o plantonista pode confiar que aquele pedido ficou persistido: um registro com as métricas do turn e um evento de trace por item do array `trace`, com o nó e o payload, na mesma ordem da resposta.

**Why this priority**: É o “trace persistido”. O id da US1 só correlaciona se o turn puder ser reaberto depois que a resposta HTTP já se foi.

**Independent Test**: Com banco em memória e estratégia fake (sem rede), concluir um `POST /chat` `200` com trace conhecido e ler o store: uma linha em `requests` com as métricas da resposta e N linhas em `trace_events`, ordenadas, com `node` e payload iguais aos eventos do corpo.

**Acceptance Scenarios**:

1. **Given** um turn `200` com métricas e um trace de N eventos, **When** a resposta é enviada, **Then** existe exatamente um registro `requests` daquele `requestId` com as mesmas métricas e exatamente N registros `trace_events` daquele pedido.
2. **Given** esses N eventos, **When** se lê `trace_events` na ordem de persistência, **Then** a sequência, o `node` e o payload de cada um coincidem com `trace[i]` da resposta `200`.
3. **Given** um turn `200` cujo `trace` é vazio, **When** a resposta é enviada, **Then** o registro `requests` existe e não há `trace_events` daquele pedido.
4. **Given** uma resposta de erro do `/chat`, **When** a resposta é enviada, **Then** não há registro `requests` nem `trace_events` daquele `requestId`.
5. **Given** falha ao gravar o pedido ou os eventos, **When** o turn terminaria em sucesso, **Then** a resposta não é `200` (nada fica pela metade) e o `requestId` ainda sai no corpo e no header.

---

### User Story 3 - O log do turn é uma linha JSON por evento, sem payload (Priority: P2)

Quem acompanha a saída do processo vê, para cada evento de trace de um chat `200`, uma única linha JSON. A linha identifica o pedido, a posição, o tipo e o nó. Não carrega texto de pensamento, argumentos de ferramenta, observação, plano, motivo de rota nem a resposta.

**Why this priority**: O banco guarda o payload para auditoria; o log serve para correlacionar no plantão sem vazar o conteúdo do turn. Depende do trace da US2 existir para saber o que logar.

**Independent Test**: Capturar a saída do logger durante um `POST /chat` `200` com N eventos de trace conhecidos. Há N linhas de evento, cada uma um JSON válido em uma linha, com `requestId`, índice, tipo e `node`, e sem os campos de payload. Uma linha extra resume o pedido (status e contadores), também sem payload.

**Acceptance Scenarios**:

1. **Given** um turn `200` com N eventos de trace, **When** o logger escreve o turn, **Then** há exatamente N linhas de evento de trace, na mesma ordem, cada uma um único objeto JSON.
2. **Given** qualquer linha de evento de trace, **When** se faz o parse, **Then** ela traz metadados (`requestId`, posição, `type`, `node`) e não traz payload (`content`, `args`, `steps`, `reason`, `tool`, `from`, `to`, texto da resposta ou da mensagem do usuário).
3. **Given** um turn `200` ou uma resposta de erro do `/chat`, **When** a resposta é enviada, **Then** há exatamente uma linha JSON de resumo do pedido com `requestId` e status HTTP, e no sucesso os contadores de métrica, sem payload.
4. **Given** um turn `200` com trace vazio, **When** o logger escreve, **Then** não há linha de evento de trace e há a linha de resumo do pedido.

---

### User Story 4 - Consultar um pedido pelo identificador (Priority: P2)

O plantonista chama `GET /requests/:id` com o `requestId` do chat e recebe o registro (métricas e vínculo da conversa) mais o trace na ordem original. Id desconhecido não devolve trace parcial nem cria registro.

**Why this priority**: É a leitura humana do que a US2 gravou. Sem ela o trace persistido só existe dentro do banco.

**Independent Test**: Após um `200` com trace conhecido, `GET /requests/{requestId}` devolve `200` com as mesmas métricas e o mesmo trace ordenado. Um UUID que nunca foi gravado devolve `404` e não insere linha.

**Acceptance Scenarios**:

1. **Given** um turn `200` já persistido, **When** o cliente chama `GET /requests/:id` com esse `requestId`, **Then** a resposta é `200` com o registro (id, conversa, instante, métricas) e `trace` igual, em ordem, ao array do chat.
2. **Given** um `requestId` com formato válido que não foi persistido (erro de chat ou id novo), **When** o cliente chama `GET /requests/:id`, **Then** a resposta é `404` e o store permanece sem esse pedido.
3. **Given** um `:id` vazio ou só espaços, **When** o cliente chama o GET, **Then** a resposta é `400` e nada é lido como se fosse um pedido existente.
4. **Given** o mesmo pedido persistido, **When** o cliente repete o GET, **Then** a ordem e o conteúdo do trace não mudam.

---

### Edge Cases

- Trace vazio no `200`: persiste o registro de métricas, zero `trace_events`, log só com a linha de resumo, GET devolve `trace: []`.
- Evento sem `node`: o evento ainda é persistido e logado; `node` vai vazio. No chat de produção o `200` já carimba `node`, e esta feature não afrouxa esse contrato.
- Header `X-Request-Id` enviado pelo cliente: ignorado. O id da resposta é sempre o gerado no servidor.
- Corpo do `POST /chat` com `requestId` ou outro campo fora do schema: continua `400` (`issues`), agora também com `requestId` gerado no corpo e no header. Nada é persistido.
- JSON inválido no `POST /chat`: continua `400`, com `requestId` no corpo e no header. Nada é persistido.
- Falha de gravação no meio do turn `200`: a escrita do registro e dos eventos é atômica; a resposta não é `200` e o GET daquele id é `404`.
- Dois chats concorrentes: ids distintos e traces que não se misturam.
- `GET` repetido: não reordena, não duplica evento e não altera métricas.
- Respostas de erro do chat (`400`, `404`, `422`, `500`, `503`, `504`): têm `requestId`, não têm linha em `requests` nem em `trace_events`.
- Payload grande (argumentos de ferramenta, plano longo): entra inteiro em `trace_events` e não aparece na linha de log.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Toda resposta HTTP produzida por `POST /chat` MUST incluir `requestId` (string não vazia) no corpo JSON e o mesmo valor no header `X-Request-Id`. Isso vale para `200`, `400`, `404`, `422`, `500`, `503` e `504`.
- **FR-002**: O servidor MUST gerar o `requestId` (UUID, mesmo mecanismo já usado para `conversationId`). MUST NOT aceitar o id vindo do cliente: header de entrada `X-Request-Id` é ignorado; `requestId` no corpo continua campo rejeitado pelo schema estrito.
- **FR-003**: Dois `POST /chat` distintos MUST receber `requestId` diferentes.
- **FR-004**: Um `POST /chat` `200` MUST persistir exatamente um registro na tabela SQLite `requests`, chaveado por esse `requestId`, com `conversationId`, instante de gravação e as métricas devolvidas naquele `200` (os mesmos campos e valores de `metrics`).
- **FR-005**: O mesmo `200` MUST persistir um registro em `trace_events` por elemento de `trace`, com a posição (começando em 0), o `node` do evento e o payload do evento (o objeto do trace, completo). A ordem por posição MUST ser a ordem do array `trace`.
- **FR-006**: `requests` e `trace_events` MUST viver no SQLite embarcado já usado pelo OpsPilot (`OPSPILOT_DB`; testes em `:memory:`), com statement preparado. A gravação do registro e dos eventos de um turn MUST ser atômica.
- **FR-007**: Se a gravação falhar, o `POST /chat` MUST NOT responder `200`. O `requestId` ainda MUST aparecer no corpo e em `X-Request-Id`, e não MUST restar registro parcial daquele id.
- **FR-008**: Respostas de erro do `POST /chat` MUST NOT criar registro em `requests` nem em `trace_events`.
- **FR-009**: `src/obs/logger.ts` MUST ser o único escritor dessas linhas. Para cada evento de trace de um `200`, MUST escrever exatamente uma linha JSON (um objeto, sem pretty-print) com metadados: `requestId`, posição, `type` e `node`.
- **FR-010**: Nenhuma linha de log MUST incluir payload de trace nem texto do turn: `content`, `args`, `steps`, `reason`, `tool`, `from`, `to`, resposta do assistente ou mensagem do usuário.
- **FR-011**: Todo `POST /chat` MUST escrever exatamente uma linha JSON de resumo do pedido, com `requestId` e status HTTP. No `200`, a linha também traz os contadores numéricos de `metrics`. Essa linha também MUST obedecer FR-010.
- **FR-012**: `GET /requests/:id` MUST responder `200` com o registro (`requestId`, `conversationId`, instante, `metrics`) e `trace` reconstruído dos `trace_events` em ordem de posição, payloads iguais aos persistidos.
- **FR-013**: `GET /requests/:id` com id de formato válido ausente no store MUST responder `404` com erro de domínio no formato já usado (`error.code`, `error.message`) e MUST NOT criar registro.
- **FR-014**: `GET /requests/:id` com id vazio ou só espaços MUST responder `400` e MUST NOT consultar um pedido.
- **FR-015**: Campos já existentes do `200` de `POST /chat` (`conversationId`, `answer`, `trace`, `metrics`) e os códigos de erro atuais MUST permanecer, apenas acrescidos de `requestId` no corpo.
- **FR-016**: Testes automatizados MUST cobrir, sem rede para o modelo: (a) `requestId` igual no corpo e em `X-Request-Id` no `200` e em ao menos um erro; (b) ids distintos em duas chamadas; (c) `requests` e `trace_events` fiéis ao `200`, inclusive trace vazio e ausência de registro no erro; (d) linhas JSON do logger, uma por evento, sem payload; (e) `GET /requests/:id` `200` ordenado e `404` para id desconhecido.

### Key Entities

- **ChatRequestRecord**: um turn de chat aceito e concluído com sucesso. Atributos: `requestId`, `conversationId`, instante de gravação, `metrics` (o objeto de métricas da resposta). Não guarda a resposta em texto fora do trace.
- **TraceEventRecord**: um evento do trace daquele pedido. Atributos: `requestId`, posição inteira ≥ 0, `node`, payload (o evento completo). Pertence a um `ChatRequestRecord`. A posição é única por pedido.
- **RequestLogLine**: uma linha JSON de metadados. Ou descreve um evento de trace (pedido, posição, tipo, nó) ou resume o pedido (pedido, status e, no sucesso, contadores). Nunca carrega payload.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% das respostas de chat (sucesso e erro), o identificador do corpo e o do header de resposta são o mesmo valor não vazio.
- **SC-002**: Em 100% dos pares de chats consecutivos do teste, os identificadores são diferentes.
- **SC-003**: Em 100% dos chats bem-sucedidos do teste, uma consulta posterior pelo identificador devolve as mesmas métricas e os mesmos eventos de trace, na mesma ordem, com nó e payload.
- **SC-004**: Em 100% dos chats bem-sucedidos com N eventos, o log contém N linhas de evento, cada uma um JSON de uma linha só com metadados, e nenhuma contém texto de payload.
- **SC-005**: Em 100% das consultas por identificador nunca gravado, o resultado é “não encontrado” e o número de pedidos armazenados não aumenta.
- **SC-006**: Em 100% dos testes de regressão do chat, conversa, resposta, trace, métricas e códigos de erro existentes permanecem, com o identificador apenas acrescentado.

## Assumptions

- O `requestId` é UUID gerado no servidor, no mesmo estilo do `conversationId`. Não é sequencial e não é derivado da mensagem.
- “No corpo” inclui o `200` (`requestId` ao lado de `conversationId`, `answer`, `trace`, `metrics`) e os erros: `400` ganha `requestId` junto de `issues`; os demais erros ganham `requestId` junto de `error`.
- Só o turn `200` é persistido. Erro de validação, estratégia desconhecida, conversa inexistente, timeout, modelo indisponível e erro interno levam id para correlação de log, mas não viram auditoria consultável. Não há trace parcial de turn falho.
- `requests` guarda métricas, não uma cópia solta de `answer`. O texto do turn fica no payload dos `trace_events`.
- `node` e o objeto do evento são o contrato de `trace_events`. Nomes físicos de colunas e o JSON exato das linhas de log ficam para `/speckit-plan`, desde que FR-009 e FR-010 sejam cumpridos (metadados sim, payload não).
- A linha de resumo do pedido é adicional às N linhas de evento. “1 linha JSON por evento” conta os eventos de trace, não substitui o resumo.
- Gravação atômica: ou o pedido e todos os eventos entram, ou nenhum entra e a resposta não é `200`.
- `GET /requests/:id` não lista, não filtra por conversa, não apaga e não pagina. Retenção é a vida do arquivo SQLite; não há prazo de expiração nesta feature.
- CLI, arena e chamadas diretas de estratégia não gravam `requests` nem emitem essas linhas. O escopo é o `POST /chat` e o `GET /requests/:id`.
- Não há autenticação nova. Quem alcança o servidor pode ler um pedido pelo id, como já acontece com o chat.
- O logger escreve na saída padrão do processo; testes podem injetar um escritor para capturar as linhas sem depender do processo real.
