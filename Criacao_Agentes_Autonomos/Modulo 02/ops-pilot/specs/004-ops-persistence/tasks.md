---

description: "Task list for SQLite-backed OpsPilot persistence"
---

# Tasks: Persistência real de operações

**Input**: Design documents from `/specs/004-ops-persistence/`

**Prerequisites**: plan.md, spec.md, constitution in `.specify/memory/constitution.md`

**Tests**: A feature especifíca testes determinísticos em `:memory:` e cobertura de ferramentas/validação de domínio.

**Organization**: Tarefas agrupadas por história de usuário para implementação e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências incompletas)
- **[Story]**: História à qual a tarefa pertence (US1, US2, US3)
- Incluir caminhos de arquivo exatos em cada descrição

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar a configuração do store local e os contratos de persistência compartilhados pela feature.

- [X] T001 Atualizar `.gitignore` para ignorar `data/` e manter o diretório de dados local fora de versionamento, e adicionar `OPSPILOT_DB` ao arquivo `.env.example` em `/Users/macbookpro/Workspace/Cursos/Engeriaria_IA_Aplicaca/Pratica/Criacao_Agentes_Autonomos/Modulo 02/ops-pilot/.env.example`
- [X] T002 Criar a estrutura de persistência em `src/store/` e preparar `src/store/sqlite-ops-store.ts` como ponto de implementação do store SQLite embutido
- [X] T003 [P] Definir os tipos da camada de persistência e as aliases de domínio em `src/store/sqlite-ops-store.ts` para `ServiceRecord`, `AlertRecord`, `IncidentRecord` e `RunbookRecord`, alinhando com os tipos atuais do domínio

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Base de dados local, seed idempotente, integração com o runtime e testes de regressão que bloqueiam todas as histórias.

**⚠️ CRITICAL**: Nenhuma história pode começar antes desta fase estar completa

- [X] T004 Escrever testes de regressão do store SQLite em `src/store/sqlite-ops-store.test.ts` cobrindo `:memory:`, seed idempotente, abrir/listar/resolver incidente, filtros e rejeição de domínio fora do CHECK
- [X] T005 [P] Escrever testes de regressão das ferramentas em `src/agents/tools.test.ts` cobrindo `list_incidents`, `consultar_runbook`, enums, rejeição de `status` inválido e `:memory:` como backend
- [X] T006 Implementar `SqliteOpsStore` em `src/store/sqlite-ops-store.ts` com `node:sqlite` (`DatabaseSync`), `OPSPILOT_DB` default `./data/opspilot.db`, DDL idempotente e prepared statements para todas as queries
- [X] T007 [P] Implementar validação de domínio de tabela e contagem de registros em `src/store/sqlite-ops-store.ts` com `CHECK` para `tier`, `severity` e `status`, sem concatenar SQL dinâmico
- [X] T008 Conectar a composição padrão da aplicação em `src/services/default-store.ts` para injetar o store SQLite em produção, mantendo o mock in-memory para benchmark e testes determinísticos
- [X] T009 Implementar seed mercadinho idempotente em `src/services/seed-catalog.ts` e `src/scripts/seed.ts` para criar 5 serviços, 6 alertas (3 firing, 3 resolved) e 3 runbooks (`checkout`, `payments`, `auth`)

**Checkpoint**: Foundation pronta — store real em `:memory:` e injeção de runtime consistentes; histórias podem começar em paralelo

---

## Phase 3: User Story 1 - Operações sobrevivem à reinicialização (Priority: P1) 🎯 MVP

**Goal**: O store SQLite persiste o estado em arquivo local e mantém serviços, alertas, incidentes e runbooks após reinicialização.

**Independent Test**: Semear o catálogo, abrir um incidente, reinicializar apontando para o mesmo arquivo e verificar que o incidente continua listado em `open`; repetir o seed não duplica dados.

### Tests for User Story 1

- [X] T010 [P] [US1] Adicionar teste de persistência por arquivo em `src/store/sqlite-ops-store.test.ts` validando o ciclo de reinicialização e o `resolved_at`/`summary` nulos na abertura
- [X] T011 [P] [US1] Adicionar teste de idempotência de seed em `src/store/sqlite-ops-store.test.ts` para garantir contagens fixas em `5 services`, `6 alerts` e `3 runbooks`

### Implementation for User Story 1

- [X] T012 [US1] Implementar `createService`, `createAlert`, `openIncident`, `resolveIncident`, `listIncidents` e `getRunbook` no `SqliteOpsStore` em `src/store/sqlite-ops-store.ts` usando prepared statements e mapeamento para modelos do domínio
- [X] T013 [US1] Garantir criação do diretório pai do banco em `src/store/sqlite-ops-store.ts` quando `OPSPILOT_DB` aponta para localização não existente, com erro de domínio claro em vez de stack de banco exposta
- [X] T014 [US1] Ajustar a identidade dos registros e a persistência de status em `src/store/sqlite-ops-store.ts` para que `resolved_at` seja nulo enquanto aberto e preenchido ao resolver, sem duplicar linhas
- [X] T015 [US1] Validar a composição por ambiente em `src/services/default-store.ts` para `./data/opspilot.db` default e override via `OPSPILOT_DB`

**Checkpoint**: O store escreve em arquivo persistente e recupera o mesmo estado após reinicialização, sem duplicar catálogo

---

## Phase 4: User Story 2 - Listar incidentes e consultar runbook no plantão (Priority: P2)

**Goal**: O agente consegue listar incidentes por filtro e consultar procedimentos de resposta usando o store real, com default `open` e erro claro de domínio quando não houver runbook.

**Independent Test**: Com catálogo semeado em `:memory:`, abrir e resolver incidentes, consultar `list_incidents` com `open`, `resolved`, `all` e omitido, e validar `consultar_runbook` para `checkout`/`payments`/`auth`.

### Tests for User Story 2

- [X] T016 [P] [US2] Adicionar teste de filtro padrão em `src/agents/tools.test.ts` para `list_incidents` retornar somente incidentes abertos quando `status` é omitido
- [X] T017 [P] [US2] Adicionar teste de filtros explícitos em `src/agents/tools.test.ts` para `open`, `resolved` e `all`
- [X] T018 [P] [US2] Adicionar teste de lookup de runbook em `src/agents/tools.test.ts` para `checkout`, `payments` e `auth`, e rejeição quando o serviço não existe ou não tem runbook

### Implementation for User Story 2

- [X] T019 [US2] Estender o contrato de store em `src/services/alert-store.ts` e o mock de memória em `src/services/alert-store.memory.ts` para incluir `listIncidents` e consulta de runbook sem quebrar os testes existentes
- [X] T020 [US2] Implementar `list_incidents` em `src/agents/tools.ts` com `status` em `open | resolved | all`, default `open` e validação Zod na borda
- [X] T021 [US2] Implementar `consultar_runbook` em `src/agents/tools.ts` com parâmetro `service` e retorno estruturado, com `DomainError` para serviço/runbook inexistente
- [X] T022 [US2] Ajustar o fluxo de composição de ferramentas em `src/agents/tools.ts` para incluir as duas novas operações e manter o comportamento anterior de `list_alerts`, `open_incident` e `resolve_incident`

**Checkpoint**: O plantonista consegue filtrar incidentes e consultar runbooks sem depender de banco externo

---

## Phase 5: User Story 3 - Ferramentas compreensíveis e testes isolados (Priority: P3)

**Goal**: As descrições e schemas das ferramentas seguem as 6 regras, os enums ficam fechados e a suíte usa banco volátil em memória sem contaminar o ambiente de produção.

**Independent Test**: Inspecionar schemas e descrições das ferramentas e executar a suíte determinística com `:memory:`; o bench continua usando o mock em memória para cenário reprodutível.

### Tests for User Story 3

- [X] T023 [P] [US3] Validar descrições e `.describe()` das ferramentas em `src/agents/tools.test.ts`, incluindo `open_incident` declarando quando usar e quando não usar
- [X] T024 [P] [US3] Validar enums fechados para `tier`, `status` e `severity` em `src/agents/tools.test.ts` e `src/store/sqlite-ops-store.test.ts`
- [X] T025 [P] [US3] Validar que a suíte de store e ferramentas roda em `:memory:` em `src/store/sqlite-ops-store.test.ts` e `src/agents/tools.test.ts` sem criar `./data/opspilot.db`

### Implementation for User Story 3

- [X] T026 [US3] Revisar todas as descrições em `src/agents/tools.ts` para seguir as 6 regras: o que faz, quando usar, quando não usar, efeitos colaterais, retorno e parâmetros descritos com `.describe()`
- [X] T027 [US3] Tornar os campos de domínio fechados em `src/agents/tools.ts`: `status`/`severity` e demais enums devem ser `z.enum(...)` ou equivalente, sem texto livre em domínio crítico
- [X] T028 [US3] Garantir que `src/bench.ts` e `src/bench.test.ts` continuam usando o mock in-memory em vez do SQLite real para cenários reproduzíveis, sem sair do fluxo de testes
- [X] T029 [US3] Revisar a composição de runtime e concluir que `src/services/default-store.ts` injeta SQLite para produção e o mock in-memory fica disponível para testes e bench

**Checkpoint**: A feature ficou auditável por humanos, com descrições claras e teste determinístico sem afetar o ambiente de produção

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validação final, documentação do comportamento e garantia de aderência constiutional.

- [X] T030 [P] Documentar o quickstart desta feature em `specs/004-ops-persistence/quickstart.md` cobrindo o fluxo de `OPSPILOT_DB`, seed idempotente e filtros de incidentes
- [X] T031 [P] Revisar e validar aderência à constituição em `.specify/memory/constitution.md`: SQLite embarcado, prepared statements, `:memory:` em testes, `.gitignore` e não-uso de banco tradicional
- [X] T032 Executar `npm run typecheck` e `npm run test` para confirmar que a feature está green e que o estado de runtime e os testes continuam estáveis

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — começa imediatamente
- **Foundational (Phase 2)**: depende de Setup — bloqueia todas as histórias
- **User Story 1 (Phase 3)**: depende da Phase 2 — entrega o MVP de persistência real
- **User Story 2 (Phase 4)**: depende da Phase 2 — pode seguir em paralelo com US1 se houver execução em equipe
- **User Story 3 (Phase 5)**: depende da Phase 2 — conclui qualidade operacional e isolamento de testes
- **Polish (Final Phase)**: depende de todas as histórias concluídas

### User Story Dependencies

- **US1 (P1)**: só depende da Phase 2; entrega o valor central do recurso
- **US2 (P2)**: depende da Phase 2 e da API de store já estabilizada por US1
- **US3 (P3)**: depende da Phase 2; melhora observabilidade e isolamento de ambiente

### Within Each User Story

- Testes vêm antes da implementação
- Store antes de ferramentas
- Validação de domínio antes de integração final
- Story completa antes de seguir para a próxima prioridade

### Parallel Opportunities

- `T003` pode rodar em paralelo com `T001` e `T002`
- `T004` e `T005` podem rodar em paralelo durante a Phase 2
- `T007` e `T009` podem rodar em paralelo com a implementação central do store
- `T010` e `T011` podem rodar em paralelo na US1
- `T016`, `T017` e `T018` podem rodar em paralelo na US2
- `T023`, `T024` e `T025` podem rodar em paralelo na US3
- `T030` e `T031` podem rodar em paralelo na Phase 6

---

## Parallel Example: User Story 2

```bash
# Executar em paralelo:
T016: teste de filtro padrão em src/agents/tools.test.ts
T017: teste de filtros explícitos em src/agents/tools.test.ts
T018: teste de runbook em src/agents/tools.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational
3. Completar Phase 3: US1 (persistência real e reabertura)
4. **STOP and VALIDATE**: verificar reinicialização e idempotência do seed em `:memory:` e em arquivo local
5. Entrega mínima demonstrável: store SQLite persistindo incidentes e runbooks

### Incremental Delivery

1. Setup + Foundational → fundação de banco local e testes
2. US1 → persistência real e recuperação após reinicialização
3. US2 → listagem e runbooks no plantão
4. US3 → schemas/descrições e suíte isolada
5. Polish → release do recurso com documentação e validação final

### Parallel Team Strategy

1. Time completa Setup + Foundational junto
2. Após Phase 2:
   - Dev A: US1 (store e persistência)
   - Dev B: US2 (ferramentas e consultas)
   - Dev C: US3 (descrições, enums e isolamento de teste)
3. Ao fim, o Polish valida a entrega em conjunto

---

## Notes

- [P] = arquivos diferentes, sem dependências incompletas
- [USn] mapeia a tarefa para a história correspondente para rastreabilidade
- Cada história deve ser implementável e testável de forma independente
- Testes devem ser escritos primeiro e cair antes da implementação para as partes mais críticas
- Evitar tarefas vagas, conflitos de arquivo e dependências cruzadas entre histórias
- O composto de produção deve usar SQLite; benchmarks e testes de cenário devem continuar em mock em memória
