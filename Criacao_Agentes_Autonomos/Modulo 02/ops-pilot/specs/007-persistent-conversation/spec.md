# Feature Specification: Conversa persistente no chat

**Feature Branch**: `007-persistent-conversation`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Conversa peristente: ConversationStore (append/lastMassages/create) + tabela messages como SqliteOpsStore; /chat: conversationId opcional, devolvido na resposta; 12 últimas menssagens no prompt via composição; métrica historyMessage; testes \":memory:\" + fake"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Continuar um plantão no mesmo fio de conversa (Priority: P1)

Um operador de plantão envia a primeira mensagem sem identificar conversa e recebe, junto da resposta, um identificador de conversa. Nas mensagens seguintes ele reenvia esse identificador; o OpsPilot responde levando em conta o contexto recente daquele fio, sem o operador repetir o histórico manualmente.

**Why this priority**: Persistência com identificador devolvido e reutilizado é o valor mínimo demonstrável: transforma o chat atual (stateless) em diálogo contínuo.

**Independent Test**: Com store de conversa fake determinístico e estratégia fake, chamar `POST /chat` sem `conversationId`, obter `conversationId` na resposta `200`, chamar de novo com o mesmo id e uma mensagem que só faz sentido com o turn anterior; confirmar que o histórico recente chegou ao prompt e que a resposta inclui o mesmo `conversationId`.

**Acceptance Scenarios**:

1. **Given** um corpo válido sem `conversationId`, **When** o cliente chama `POST /chat`, **Then** o sistema cria uma conversa, persiste a mensagem do usuário e a resposta do assistente, e devolve `200` com `answer`, `trace`, `metrics` e o novo `conversationId`.
2. **Given** uma conversa já criada, **When** o cliente chama `POST /chat` com o mesmo `conversationId` e nova `message`, **Then** a resposta `200` devolve o mesmo `conversationId` e a execução usa o histórico recente daquela conversa.
3. **Given** uma conversa com várias trocas, **When** o cliente continua no mesmo fio, **Then** usuário e assistente aparecem no histórico na ordem cronológica.

---

### User Story 2 - Limitar o contexto às 12 mensagens mais recentes (Priority: P2)

Em plantões longos, o operador continua no mesmo fio sem degradar a relevância: apenas as 12 mensagens mais recentes entram no prompt. A quantidade efetivamente injetada fica visível na métrica `historyMessages`, permitindo auditoria do tamanho do contexto usado.

**Why this priority**: Sem janela fixa, conversas longas incham o prompt; a métrica torna o comportamento observável. Depende do fluxo P1 já persistir mensagens.

**Independent Test**: Com store fake ou `:memory:`, gravar mais de 12 mensagens em uma conversa, disparar um turn via composição e verificar que no máximo 12 mensagens entram no prompt e que `metrics.historyMessages` reflete exatamente essa quantidade.

**Acceptance Scenarios**:

1. **Given** uma conversa com 12 ou menos mensagens, **When** um novo turn é executado, **Then** todas as mensagens existentes entram no prompt e `historyMessages` iguala essa contagem.
2. **Given** uma conversa com mais de 12 mensagens, **When** um novo turn é executado, **Then** apenas as 12 mais recentes entram no prompt e `historyMessages` é `12`.
3. **Given** a primeira mensagem de uma conversa nova, **When** o turn é executado, **Then** `historyMessages` é `0` (ainda não havia histórico prévio a injetar).

---

### User Story 3 - Testar conversa sem disco e sem rede (Priority: P3)

Quem mantém o OpsPilot valida o store de conversa em banco volátil `:memory:` (espelhando o padrão do store operacional) e valida o endpoint/composição com um store fake em memória, sem criar arquivo em `data/` e sem rede.

**Why this priority**: Garantia de regressão e alinhamento à constituição; não entrega o valor de negócio sozinha.

**Independent Test**: Rodar testes do store SQLite de mensagens com `:memory:` (create, append, lastMessages) e testes de integração do chat com ConversationStore fake + estratégia fake; ambos passam sem disco de produção e sem rede.

**Acceptance Scenarios**:

1. **Given** o store SQLite de conversa apontado para `:memory:`, **When** se cria conversa, anexa mensagens e lê as últimas N, **Then** os dados refletem a ordem de append e o limite N.
2. **Given** a suíte de integração do `/chat` com ConversationStore fake, **When** ela executa, **Then** cobre criação implícita, continuidade por `conversationId` e inclusão de `historyMessages` sem rede.
3. **Given** a composição de produção, **When** o runtime sobe, **Then** o ConversationStore SQLite é injetado; o fake permanece disponível para testes.

---

### Edge Cases

- `conversationId` inexistente: rejeição previsível na fronteira (erro de domínio traduzido em HTTP 4xx), sem criar conversa silenciosa com outro id.
- `conversationId` vazio ou só espaços: erro de validação `400` com issues Zod.
- Corpo sem `conversationId` continua válido (cria conversa nova).
- Falha ao persistir após a estratégia responder: erro de domínio/borda claro; não devolver sucesso sem `conversationId` coerente com o que foi gravado.
- Conversa sem mensagens ainda (id criado mas vazio): `lastMessages` devolve lista vazia; `historyMessages` é `0`.
- Pedir últimas N com N ≤ 0 na API interna do store: comportamento definido e testado (rejeitar ou devolver vazio); o caminho de produção usa N = 12.
- Reinício do processo com o mesmo arquivo `OPSPILOT_DB`: mensagens da conversa sobrevivem (mesmo banco do store operacional).
- Contratos existentes de `strategy`, `reflect`, timeout 180s, 400/422/504 permanecem inalterados.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST disponibilizar um contrato `ConversationStore` com ao menos `create`, `append` e `lastMessages` (leitura das N mensagens mais recentes de uma conversa, em ordem cronológica).
- **FR-002**: O sistema MUST persistir mensagens em tabela `messages` no mesmo SQLite embarcado do store operacional (`SqliteOpsStore` / `OPSPILOT_DB`, padrão `./data/opspilot.db`), com DDL idempotente e statements preparados (sem SQL concatenado com entrada externa).
- **FR-003**: Cada mensagem persistida MUST registrar ao menos: vínculo com a conversa, papel (`user` | `assistant`), conteúdo textual e ordenação temporal estável para `lastMessages`.
- **FR-004**: `POST /chat` MUST aceitar `conversationId` opcional no corpo (além de `message`, `strategy?`, `reflect?`), validado com Zod.
- **FR-005**: Toda resposta de sucesso `200` de `POST /chat` MUST incluir `conversationId` (criado se omitido; o mesmo id se informado e válido), além de `answer`, `trace` e `metrics`.
- **FR-006**: Quando `conversationId` for omitido, o sistema MUST criar uma conversa via `ConversationStore.create` antes de processar o turn.
- **FR-007**: Quando `conversationId` for informado e existir, o sistema MUST carregar até as 12 mensagens mais recentes via `lastMessages` e injetá-las no prompt pela composição de runtime (não pelo cliente).
- **FR-008**: Após a execução da estratégia, o sistema MUST fazer `append` da mensagem do usuário e da resposta do assistente na conversa correspondente.
- **FR-009**: O objeto `metrics` da resposta MUST incluir `historyMessages` (inteiro ≥ 0) com a quantidade de mensagens de histórico efetivamente injetadas no prompt daquele turn.
- **FR-010**: A composição de produção MUST injetar a implementação SQLite do `ConversationStore`. Testes MUST poder usar `:memory:` para o store SQLite e um fake em memória para isolamento do endpoint/composição.
- **FR-011**: Testes MUST cobrir, sem rede: create/append/lastMessages em `:memory:`; continuidade de conversa no `/chat` com fake; janela de 12 mensagens e valor de `historyMessages`.
- **FR-012**: `conversationId` desconhecido MUST resultar em erro de domínio traduzido na borda (sem vazar SQL); corpo inválido permanece `400` com issues Zod.

### Key Entities

- **Conversation**: fio de diálogo identificado por `conversationId`; agrupa mensagens ordenadas no tempo.
- **Message**: turno textual com papel `user` ou `assistant`, conteúdo e vínculo à conversa.
- **ChatRequest**: solicitação ao `/chat` com `message` obrigatória, `conversationId` opcional, e demais campos já existentes.
- **ChatResponse**: resultado do turn com `answer`, `trace`, `metrics` (incluindo `historyMessages`) e `conversationId`.
- **HistoryWindow**: subconjunto das até 12 mensagens mais recentes injetadas no prompt de um turn.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das solicitações válidas sem `conversationId` recebem `200` com um `conversationId` não vazio e persistem ao menos o par usuário/assistente daquele turn.
- **SC-002**: 100% das solicitações válidas com `conversationId` existente reutilizam o mesmo id na resposta e executam com o histórico recente daquela conversa.
- **SC-003**: Em conversas com mais de 12 mensagens, 100% dos turns de teste injetam exatamente 12 mensagens no prompt e reportam `historyMessages = 12`.
- **SC-004**: Em conversas novas (sem histórico prévio), 100% dos primeiros turns reportam `historyMessages = 0`.
- **SC-005**: 100% dos `conversationId` inexistentes exercitados na suíte recebem erro 4xx acionável, sem criar dados sob outro id.
- **SC-006**: A suíte determinística (store `:memory:` + chat com fake) conclui sem criar `./data/opspilot.db` e sem acesso à rede.
- **SC-007**: Após gravar mensagens e reiniciar o processo com o mesmo arquivo de dados, 100% das mensagens da conversa permanecem recuperáveis via `lastMessages`.

## Assumptions

- O identificador de conversa é um texto opaco gerado pelo store (ex.: UUID); o cliente apenas ecoa o valor recebido.
- “12 últimas mensagens” significa 12 registros Message (não 12 pares user/assistant); papéis mistos contam individualmente.
- `historyMessages` conta só o histórico prévio injetado no prompt, não a mensagem atual do usuário deste turn.
- A tabela `messages` vive no mesmo banco SQLite do `SqliteOpsStore` (mesmo `OPSPILOT_DB`), alinhado à constituição VII; DDL pode ser adicionado no store existente ou em store irmão que compartilha a conexão — detalhe do plano.
- O mock/fake de `ConversationStore` existe para testes (e, se útil, bench); produção usa a implementação SQLite.
- Autenticação, listagem de conversas, exclusão/edição de mensagens, streaming e multi-tenant ficam fora do escopo desta feature.
- Os comportamentos de `strategy`, `reflect`, timeout e códigos 400/422/504 da spec `003-chat-endpoint` permanecem válidos.
- O typo do pedido `lastMassages` / `historyMessage` / `menssagens` / `peristente` foi normalizado para `lastMessages`, `historyMessages`, mensagens e persistente.
