# Feature Specification: Persistência real de operações

**Feature Branch**: `004-ops-persistence`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "Persistência real de operações: SqliteOpsStore (src/store/sqlite-ops-store.ts) implementa a interface OpsStore existente via node:sqlite (DatabaseSync); caminho em OPSPILOT_DB (default ./data/opspilot.db); \":memory:\" nos testes. 4 tabelas - services, alerts, incidentes, runbooks - espelhando os tipos atuais do domínio (incidentes ganha resolved_at e summary, anuláveis); DDL idempotente no construtor; CHECK em todo campo de domínio fechado (tier, severity, status). seed idempotente = cenário mercadinho do mock (5 serviços, 6 alertas: 3 firing, 3 resolved, runbooks de checkout/payments/auth). prepared statements em todo query; SEM SQL concatenado. tools novas: list_incidents(status open | resolved | all, default open) e consultar_runbook(service) - descrições pelas 6 regras. composição injeta o SqliteOpsStore; mock in memory fica para testes e para o bench (cenários possam ser reproduzidas). data/ no .gitignore. revisar descrições de src/agents/tools.ts pelas 6 regras (dívida do open_incident: quando usar; .describe() em todo campo; enums). testes \":memory:\" seed, abrir/listar/resolver, filtros e CHECKS; testes das tools existentes passam a rodar sobre \":memory:\"."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operações sobrevivem à reinicialização (Priority: P1)

Um plantonista usa o OpsPilot para abrir e resolver incidentes sobre o catálogo do mercadinho. Depois de encerrar o processo e subir de novo, os serviços, alertas, incidentes e runbooks continuam disponíveis no mesmo estado. Não é mais necessário um servidor de banco separado: o arquivo local (ou o caminho configurado) é suficiente.

**Why this priority**: Sem persistência real, cada restart apaga o plantão. É o valor central desta feature e o MVP demonstrável.

**Independent Test**: Semear o catálogo, abrir um incidente, encerrar o processo, reabrir com o mesmo arquivo de dados e listar incidentes abertos; o incidente criado ainda existe. Repetir o seed não duplica serviços, alertas nem runbooks.

**Acceptance Scenarios**:

1. **Given** o catálogo mercadinho ainda não instalado no arquivo de dados, **When** o seed roda, **Then** existem 5 serviços, 6 alertas (3 em disparo e 3 resolvidos) e runbooks para checkout, payments e auth.
2. **Given** o seed já executado, **When** o seed roda de novo, **Then** as quantidades não aumentam (idempotência por chave natural).
3. **Given** um incidente aberto no arquivo de dados, **When** o processo é reiniciado apontando para o mesmo arquivo, **Then** listar incidentes abertos devolve aquele incidente, com `resolved_at` e `summary` nulos enquanto estiver aberto.
4. **Given** nenhum caminho configurado, **When** a composição padrão sobe, **Then** o arquivo de dados usado é `./data/opspilot.db`.
5. **Given** `OPSPILOT_DB` definido, **When** a composição padrão sobe, **Then** o store usa exatamente esse caminho.

---

### User Story 2 - Listar incidentes e consultar runbook no plantão (Priority: P2)

O agente (ou o plantonista via agente) lista incidentes filtrando por abertos, resolvidos ou todos, e consulta o runbook de um serviço. Sem filtro explícito, só os abertos aparecem. Isso complementa as ferramentas já existentes de listar alertas, abrir e resolver incidente.

**Why this priority**: Persistência sem as novas consultas não muda o que o agente consegue fazer no plantão; depende do store real já existir.

**Independent Test**: Com catálogo semeado em memória volátil, abrir dois incidentes, resolver um, listar com cada filtro (`open`, `resolved`, `all` e omitido) e consultar runbook de checkout; confirmar contagens, default `open` e conteúdo do runbook.

**Acceptance Scenarios**:

1. **Given** incidentes abertos e resolvidos, **When** `list_incidents` é chamada sem `status`, **Then** apenas os abertos são devolvidos.
2. **Given** o mesmo conjunto, **When** `status` é `open`, `resolved` ou `all`, **Then** o resultado contém só abertos, só resolvidos ou todos, respectivamente.
3. **Given** o seed mercadinho, **When** `consultar_runbook` é chamada com `checkout`, `payments` ou `auth`, **Then** o runbook daquele serviço é devolvido.
4. **Given** um serviço sem runbook ou inexistente, **When** `consultar_runbook` é chamada, **Then** o chamador recebe erro de domínio claro, sem SQL nem detalhe interno.
5. **Given** um incidente resolvido, **When** ele é listado, **Then** `resolved_at` está preenchido e `summary` pode permanecer nulo até ser informado.

---

### User Story 3 - Ferramentas compreensíveis e testes isolados (Priority: P3)

Quem mantém o agente revisa as descrições das ferramentas pelas 6 regras (o que faz, quando usar, quando não usar, efeitos, retorno, parâmetros descritos). Em especial, `open_incident` deixa explícito quando usar. Cada campo do schema tem descrição; campos de domínio fechado são enums. Testes de store e das ferramentas atuais rodam em banco volátil em memória, sem sujar disco. O bench e testes que precisam de cenário reproduzível continuam usando o mock em memória.

**Why this priority**: Melhora a seleção de ferramentas e a confiabilidade da suíte, mas não entrega persistência sozinha.

**Independent Test**: Inspecionar schemas/descrições das ferramentas (incluindo as duas novas) e rodar a suíte determinística apontando persistência para `:memory:`; o bench continua montando o mock in-memory por cenário.

**Acceptance Scenarios**:

1. **Given** as ferramentas operacionais, **When** o modelo lê as descrições, **Then** cada uma cobre as 6 regras, `open_incident` declara quando usar (e quando não), e todo campo tem `.describe()`.
2. **Given** `status` e `severity` nas ferramentas, **When** o schema é definido, **Then** os valores permitidos são enums fechados, não texto livre.
3. **Given** a suíte de testes do store e das ferramentas existentes, **When** ela executa, **Then** usa persistência volátil `:memory:` (seed, abrir/listar/resolver, filtros e rejeição de valores fora do domínio).
4. **Given** o bench, **When** um cenário é montado, **Then** o store é o mock em memória, para o cenário poder ser reproduzido isoladamente da composição de produção.

---

### Edge Cases

- Valor de `tier`, `severity` ou `status` fora do conjunto fechado: a persistência rejeita a escrita (restrição de domínio) e as ferramentas rejeitam na fronteira com erro claro.
- `list_incidents` com `status` inválido: rejeição na fronteira, sem consultar o store.
- Seed em arquivo já populado com o mesmo catálogo: nenhuma linha duplicada.
- Caminho `OPSPILOT_DB` apontando para diretório inexistente: o store cria o diretório pai ou falha com erro de domínio/configuração claro, sem stack de banco vazada.
- Consultar runbook com nome vazio ou só espaços: rejeição na fronteira.
- Resolver incidente inexistente: erro de domínio; resolver já resolvido permanece idempotente.
- Composição de produção MUST injetar o store SQLite; testes e bench MUST NÃO depender do arquivo `./data/opspilot.db`.
- Arquivo de dados local MUST permanecer fora do versionamento (`data/` no `.gitignore`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST persistir serviços, alertas, incidentes e runbooks em SQLite embarcado que implementa o contrato de store operacional já usado pelas ferramentas (OpsStore / store atual).
- **FR-002**: O caminho do arquivo MUST ser lido de `OPSPILOT_DB`, com padrão `./data/opspilot.db`; o valor especial `:memory:` MUST ser usado nos testes de persistência e de ferramentas.
- **FR-003**: O modelo persistido MUST ter quatro coleções — `services`, `alerts`, `incidentes` e `runbooks` — espelhando os tipos atuais do domínio. Incidente MUST incluir `resolved_at` e `summary`, ambos anuláveis.
- **FR-004**: A criação do esquema MUST ser idempotente na inicialização do store (reabrir o mesmo arquivo não falha nem recria dados).
- **FR-005**: Todo campo de domínio fechado (`tier`, `severity`, `status`) MUST ser restringido na persistência (CHECK) e na fronteira das ferramentas (enum).
- **FR-006**: O seed MUST instalar o cenário mercadinho do mock: 5 serviços, 6 alertas (3 `firing`, 3 `resolved`) e runbooks de `checkout`, `payments` e `auth`, e MUST ser idempotente.
- **FR-007**: Toda consulta MUST usar statement preparado. Concatenar SQL com entrada externa é proibido.
- **FR-008**: O sistema MUST expor a ferramenta `list_incidents` com `status` `open` | `resolved` | `all` e default `open`.
- **FR-009**: O sistema MUST expor a ferramenta `consultar_runbook` com argumento `service` (nome do serviço).
- **FR-010**: As descrições de todas as ferramentas em `src/agents/tools.ts` (existentes e novas) MUST seguir as 6 regras: o que faz; quando usar; quando não usar; efeitos colaterais; o que retorna; parâmetros com `.describe()`. A dívida de `open_incident` (quando usar) MUST ser sanada.
- **FR-011**: A composição de runtime (agentes, chat, seed) MUST injetar o store SQLite. O mock em memória MUST permanecer disponível para testes e para o bench, para que cenários sejam reproduzíveis.
- **FR-012**: O diretório de dados local (`data/`) MUST constar no `.gitignore`.
- **FR-013**: Testes MUST cobrir, em `:memory:`: seed idempotente; abrir, listar e resolver incidente; filtros de listagem; rejeição de valores que violam CHECK/domínio. Testes das ferramentas existentes MUST passar a rodar sobre `:memory:`.
- **FR-014**: Falhas previsíveis (serviço/incidente/runbook inexistente, valor fora do enum, configuração de caminho inválida) MUST ser erros de domínio traduzidos na borda, sem vazar SQL.

### Key Entities

- **Serviço**: serviço monitorado do mercadinho; nome (chave natural) e `tier` em conjunto fechado; relaciona-se com alertas, incidentes e runbook opcional.
- **Alerta**: condição detectada em um serviço; título, status (`firing` | `resolved`) e vínculo com o serviço.
- **Incidente**: ocorrência operacional; título, serviço, severidade (`low` | `medium` | `high` | `critical`), status (`open` | `resolved`), `resolved_at` e `summary` anuláveis.
- **Runbook**: procedimento de resposta associado a um serviço (no seed: checkout, payments, auth).
- **Catálogo mercadinho**: conjunto inicial reproduzível de 5 serviços e 6 alertas (3 em disparo, 3 resolvidos) mais os três runbooks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Após abrir um incidente e reiniciar o processo com o mesmo arquivo de dados, 100% dos incidentes, alertas, serviços e runbooks anteriores continuam visíveis.
- **SC-002**: Reexecutar o seed 2 vezes consecutivas produz as mesmas contagens (5 serviços, 6 alertas, 3 runbooks), sem duplicatas.
- **SC-003**: `list_incidents` sem argumento devolve somente abertos em 100% dos casos de teste; os três filtros explícitos cobrem abertos, resolvidos e todos.
- **SC-004**: Consultar runbook de checkout, payments e auth devolve procedimento em 100% dos casos após o seed; serviço sem runbook falha de forma acionável.
- **SC-005**: 100% das escritas com `tier`, `severity` ou `status` inválidos são rejeitadas antes de corromper o catálogo.
- **SC-006**: A suíte determinística (store + ferramentas) conclui sem criar `./data/opspilot.db` e sem acesso à rede.
- **SC-007**: Um mantenedor identifica quando usar (e quando não usar) `open_incident` só pela descrição da ferramenta, sem ler o código.

## Assumptions

- A interface de store já usada pelas ferramentas (hoje o contrato de alertas/incidentes) é a `OpsStore` a ser implementada pelo store SQLite; métodos novos (`listIncidents`, consulta de runbook) estendem esse contrato.
- O cenário mercadinho reutiliza o mock de plantão já usado no bench (serviços incluindo `checkout`, `payments` e `auth`; os outros dois nomes e os 6 títulos de alerta são os do catálogo mock vigente, definidos no plano).
- `consultar_runbook` é o nome canônico da ferramenta (o pedido escreveu `consultar_rubook` por engano).
- `tier` é um enum fechado a definir no plano (valores típicos de criticidade de serviço, p.ex. `critical` | `high` | `standard`), persistido com CHECK.
- Implementação prevista no plano: `SqliteOpsStore` em `src/store/sqlite-ops-store.ts` com `node:sqlite` (`DatabaseSync`); DDL no construtor; composição injeta essa classe no runtime.
- MySQL/Sequelize deixam de ser o caminho de produção desta feature, em conformidade com a constituição v2.0.0; migração de dados MySQL existentes está fora de escopo.
- O mock em memória não some: bench e testes de cenário continuam podendo montá-lo para reprodutibilidade.
- Não há interface HTTP nova nesta feature; as ferramentas entram no mesmo conjunto já injetado nos agentes.
