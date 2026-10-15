# Feature Specification: Sumarização de histórico (pruning)

**Feature Branch**: `011-history-summarization`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Sumarização de histórico (pruning): tabela conversation_summaries; o que sai das 8 mesagens recentes vira resumo de ~150 tokens preservando decisões, fatos e pendências, MESCLANDO ao resumo anterior e persistido - refeito só quando 8 novas saem da janela, nunca a cada request. Resumo entra no contexto; evento \"summarize\". Com teste fake"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Conversas longas preservam o essencial sem inflar o contexto (Priority: P1)

Em um plantão longo, o operador continua no mesmo `conversationId`. Só as 8 mensagens mais recentes entram cruas no prompt. O que já saiu dessa janela é representado por um resumo curto (~150 tokens) que preserva decisões tomadas, fatos estabelecidos e pendências abertas. Esse resumo é mesclado ao resumo anterior, persistido e reinjetado no contexto dos turns seguintes — sem o operador repetir o histórico.

**Why this priority**: Sem pruning com resumo, plantões longos perdem continuidade útil ou estouram o contexto. É o valor mínimo demonstrável da feature.

**Independent Test**: Com store fake e sumarizador fake determinístico, gravar mais de 8 mensagens, executar um turn após o primeiro lote sair da janela e verificar: (a) só 8 mensagens cruas no histórico injetado; (b) o resumo persistido entra no contexto; (c) o resumo contém decisões/fatos/pendências do material podado; (d) existe um evento de rastreio `summarize` nesse turn de consolidação.

**Acceptance Scenarios**:

1. **Given** uma conversa com 8 ou menos mensagens, **When** um turn é executado, **Then** todas as mensagens entram cruas no contexto, nenhum resumo é exigido e nenhum evento `summarize` é emitido.
2. **Given** uma conversa em que exatamente 8 mensagens acabaram de sair da janela das 8 mais recentes e ainda não foram sumarizadas, **When** o próximo turn elegível roda, **Then** o sistema produz um resumo de ~150 tokens desse lote, persiste-o, injeta-o no contexto junto com as 8 recentes e registra um evento `summarize` no rastreio daquele turn.
3. **Given** já existe um resumo persistido e um novo lote de 8 mensagens sai da janela, **When** a consolidação ocorre, **Then** o novo resumo é o resultado da mescla do resumo anterior com o lote que saiu (ainda ~150 tokens, preservando decisões, fatos e pendências) e substitui o resumo anterior persistido.
4. **Given** um resumo já persistido, **When** turnos seguintes usam o mesmo `conversationId` sem novo lote elegível, **Then** o resumo atual entra no contexto sem ser refeito.

---

### User Story 2 - Sumarização sob demanda em lote, nunca a cada request (Priority: P2)

O custo de sumarizar não é pago em todo `POST /chat`. A consolidação só roda quando um lote novo de 8 mensagens saiu da janela desde a última consolidação. Pedidos intermediários reutilizam o resumo já persistido.

**Why this priority**: Evita custo e latência desnecessários; sem essa regra, cada request reescreveria o resumo. Depende do fluxo P1 já persistir e injetar o resumo.

**Independent Test**: Com fake, avançar a conversa de forma que já exista resumo e ainda não haja 8 novas mensagens fora da janela; executar vários turns e assertar zero eventos `summarize` e zero regravação do resumo. Em seguida, fazer sair mais 8 da janela e assertar exatamente uma consolidação.

**Acceptance Scenarios**:

1. **Given** um resumo persistido e menos de 8 mensagens novas fora da janela desde a última consolidação, **When** o cliente chama `POST /chat` uma ou várias vezes, **Then** o sistema não refaz o resumo, não emite `summarize` e reutiliza o texto já persistido no contexto.
2. **Given** que exatamente 8 mensagens novas saíram da janela desde a última consolidação, **When** o turn elegível é processado, **Then** ocorre exatamente uma consolidação (mescla + persistência + evento `summarize`) naquele ciclo — não uma por mensagem individual do lote.
3. **Given** turnos em que nada saiu da janela (conversa curta ou só dentro das 8 recentes), **When** o chat responde, **Then** não há consolidação nem evento `summarize`.

---

### User Story 3 - Validar pruning com fakes, sem rede (Priority: P3)

Quem mantém o OpsPilot cobre o comportamento com sumarizador fake e stores fake (ou banco volátil em memória), sem rede e sem gravar em `./data/opspilot.db` de produção.

**Why this priority**: Garantia de regressão alinhada à constituição; não entrega valor de plantão sozinha.

**Independent Test**: Rodar a suíte com ConversationStore/resumo fake e sumarizador fake determinístico; cobrir janela 8, consolidação em lote de 8, mescla, injeção no contexto, ausência de re-sumarização a cada request e presença do evento `summarize` só nos turns de consolidação.

**Acceptance Scenarios**:

1. **Given** a suíte de testes com fakes, **When** ela executa, **Then** passa sem acesso à rede e sem criar o arquivo de dados de produção.
2. **Given** o sumarizador fake, **When** recebe um lote + resumo anterior conhecidos, **Then** devolve um texto determinístico adequado para asserts (tamanho alvo ~150 tokens e inclusão dos eixos decisão/fato/pendência quando presentes no material).
3. **Given** a composição de produção, **When** o runtime sobe, **Then** a persistência real de resumos e o sumarizador de produção são usados; os fakes permanecem disponíveis para testes.

---

### Edge Cases

- Conversa nova ou com ≤ 8 mensagens: sem resumo, sem evento `summarize`, `historyMessages` reflete só as mensagens cruas injetadas (0..8).
- Exatamente 9 mensagens: 1 mensagem fora da janela — ainda não consolida (lote incompleto de 8); as 8 recentes entram cruas; a mensagem fora ainda não tem representação no resumo até o lote fechar (ou fica coberta pela regra de elegibilidade documentada nas Assumptions).
- Falha ao sumarizar ou persistir o resumo no turn elegível: erro de domínio/borda previsível; não devolver sucesso afirmando consolidação que não ocorreu; turns seguintes podem retentar a consolidação pendente.
- Resumo anterior ausente no primeiro lote: a mescla equivale a sumarizar só o lote que saiu.
- Conteúdo do lote sem decisões/fatos/pendências explícitas: o resumo ainda é gerado e persistido; preserva o que houver de relevante no material.
- Reinício do processo com o mesmo arquivo de dados: o resumo da conversa permanece recuperável e reentra no contexto.
- Contratos existentes de `strategy`, `reflect`, timeout, memórias e códigos 400/404/422/504 permanecem válidos; a janela crua passa de 12 para 8 mensagens nesta feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST manter no máximo as **8** mensagens mais recentes da conversa como histórico cru injetado no prompt (`historyMessages` ≤ 8).
- **FR-002**: O sistema MUST persistir o resumo de conversa em tabela `conversation_summaries` no mesmo store embarcado das mensagens/operações, com DDL idempotente e acesso via statements preparados.
- **FR-003**: Cada registro de resumo MUST vincular-se a uma conversa e guardar o texto do resumo vigente (após mescla), de forma que reinícios do processo recuperem o mesmo conteúdo.
- **FR-004**: Quando um lote de **8** mensagens sai da janela das 8 recentes desde a última consolidação, o sistema MUST sumarizar esse lote em um texto de cerca de **150 tokens**, preservando decisões, fatos e pendências presentes no material.
- **FR-005**: A consolidação MUST **mesclar** o resumo anterior (se existir) com o novo lote podado, produzindo um único resumo vigente ~150 tokens, e MUST persistir esse resultado em `conversation_summaries` (substituindo o anterior daquela conversa).
- **FR-006**: O sistema MUST **não** refazer o resumo a cada request: consolidação só ocorre quando há um lote novo de 8 mensagens elegíveis fora da janela; demais turns apenas leem e reutilizam o resumo persistido.
- **FR-007**: Quando existir resumo persistido para a conversa, o sistema MUST incluí-lo no contexto do turn junto com as até 8 mensagens recentes.
- **FR-008**: Em todo turn em que uma consolidação for executada, o rastreio MUST incluir um evento com tipo/nome `summarize`. Turns sem consolidação MUST NOT emitir esse evento.
- **FR-009**: Testes MUST cobrir o comportamento com sumarizador fake (e store fake / `:memory:` conforme o padrão do projeto), sem rede: janela 8, consolidação em lote, mescla, injeção no contexto, ausência de re-sumarização por request e emissão de `summarize` só na consolidação.
- **FR-010**: A composição de produção MUST usar a persistência real de `conversation_summaries` e o sumarizador de produção; fakes permanecem para a suíte de testes.
- **FR-011**: Métricas e contratos já existentes (`conversationId`, `promptTokens`, `contextBreakdown`, memórias, etc.) MUST permanecer coerentes; `historyMessages` passa a refletir a janela crua de até 8 (não 12).

### Key Entities

- **HistoryWindow**: as até 8 mensagens mais recentes injetadas cruas no prompt.
- **PrunedBatch**: conjunto de exatamente 8 mensagens que saíram da janela desde a última consolidação e ainda não foram absorvidas pelo resumo.
- **ConversationSummary**: texto vigente (~150 tokens) associado a uma conversa; resultado da mescla do resumo anterior com o lote podado; persistido em `conversation_summaries`.
- **SummarizeEvent**: evento de rastreio `summarize` emitido apenas quando uma consolidação ocorre naquele turn.
- **Conversation**: fio já existente (`conversationId`); agrupa mensagens e no máximo um resumo vigente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em conversas com mais de 8 mensagens, 100% dos turns de teste injetam no máximo 8 mensagens cruas de histórico.
- **SC-002**: Após o primeiro lote de 8 mensagens sair da janela, 100% dos turns elegíveis de consolidação produzem e persistem um resumo reutilizável nos turns seguintes.
- **SC-003**: Em 100% dos turns de teste sem lote novo de 8 fora da janela, o resumo não é refeito e o evento `summarize` não aparece.
- **SC-004**: Em 100% dos turns de consolidação de teste, o rastreio contém exatamente o evento `summarize` correspondente àquela consolidação.
- **SC-005**: Em 100% das consolidações de teste com resumo prévio, o resumo persistido resultante reflete a mescla (não descarta o anterior nem ignora o lote novo) e permanece na ordem de ~150 tokens.
- **SC-006**: Após reinício com o mesmo arquivo de dados, 100% das conversas com resumo prévio reinserem esse resumo no contexto sem precisar reconsolidar só por causa do reinício.
- **SC-007**: A suíte determinística com fakes conclui sem rede e sem criar o arquivo de dados de produção.

## Assumptions

- “8 mensagens recentes” conta registros de mensagem individuais (papéis `user`/`assistant`), não pares; esta feature **substitui** a janela crua de 12 da conversa persistente pela janela de 8.
- “~150 tokens” é alvo aproximado do resumo vigente após cada mescla (não um hard cap byte-a-byte); testes com fake podem fixar um texto compatível com esse alvo via a estimativa de tokens já usada no projeto (`floor(chars/4)`), detalhe fino no plano.
- “8 novas saem da janela” significa: consolidar somente quando o acumulado de mensagens ainda não cobertas pelo resumo e fora das 8 recentes atingir 8; nunca sumarizar por request nem por mensagem unitária.
- Até fechar o primeiro (ou próximo) lote de 8, mensagens já fora da janela mas abaixo do limiar **não** entram no prompt cru; a continuidade delas fica pendente até a consolidação — trade-off aceito para evitar custo a cada request. Se o plano preferir um fallback temporário, não altera o requisito de não sumarizar a cada request.
- Mescla no primeiro lote sem resumo prévio = sumarizar só o lote.
- O evento `summarize` é um passo do rastreio do turn (mesmo canal de eventos já usado pelo agente), não um novo endpoint HTTP.
- `conversation_summaries` vive no mesmo banco embarcado (`OPSPILOT_DB`); um resumo vigente por conversa (upsert) é o modelo padrão.
- Sumarizador de produção pode usar o mesmo provedor/modelo do agente; testes usam fake determinístico sem rede.
- Autenticação, UI de edição de resumos, sumarização manual sob demanda e mudança dos códigos HTTP de erro existentes ficam fora de escopo.
- Typo do pedido (`mesagens`, aspas do evento) normalizado para mensagens e evento `summarize`.
