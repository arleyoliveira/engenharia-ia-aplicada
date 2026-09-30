---
description: "Task list for team mode"
---

# Tasks: Modo equipe

**Input**: Design documents from `/specs/018-team-mode/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, constitution

**Tests**: A spec exige suíte sem rede (FR-014): ciclo supervisor e papéis com quadro acumulado; exclusividade da rota `team`; allowlist e campos do quadro; zero incidente sem handoff `executor`; evento `handoff`; "ver raciocínio"; teto 8; tabela do roteador; override; `422`; saída inválida sem fallback. Ver [contracts/](contracts/) e [quickstart.md](quickstart.md).

**Organization**: Por história. Contratos: [contracts/team-mode.md](contracts/team-mode.md), [contracts/handoff-trace.md](contracts/handoff-trace.md), [contracts/chat-http.md](contracts/chat-http.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos distintos, sem dependência incompleta)
- **[Story]**: US1 / US2 / US3 / US4
- Incluir caminhos de arquivo exatos

## Path Conventions

- Modo: `src/team/`
- Grafo de produção: `src/graph/production-Graph.ts`
- Trace textual: `src/agents/trace.ts`
- Painel: `web/src/model/trace-lines.ts` e `web/src/ui/WarRoom.test.tsx`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Tipo do evento `handoff` e constantes do supervisor, sem grafo ainda.

- [X] T001 Em `src/agents/types.ts`, acrescentar ao union `TraceEvent` a variante `{ type: "handoff"; next: "analista" | "planejador" | "executor" | "fim"; brief: string; node: "supervisor" }`. Não remover nem alterar as variantes `route`, `thought`, `action`, `observation`, `plan`, `critique`, `answer`, `summarize` e `fallback`
- [X] T002 [P] Criar `src/team/team-graph.ts` exportando `TEAM_HANDOFF_LIMIT` = `8`, `LIMIT_ANSWER` = `Execução interrompida: limite de iterações (8) atingido.`, o tuple `TEAM_NEXT` = `analista` | `planejador` | `executor` | `fim`, e `supervisorSchema` Zod com `next` nesse enum e `brief` string. Sem `StateGraph` nesta tarefa

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Quadro puro do turno. US1, US2 e US4 escrevem nele. US3 não depende desta fase.

**⚠️ CRITICAL**: US1 não começa antes desta fase

- [X] T003 Em `src/team/blackboard.test.ts` (`node:test` + `tsx`): `emptyBlackboard()` tem `findings` e `plan` `""` e `actions` e `briefs` vazios. `appendFindings` concatena com `\n` só quando já havia texto. `replacePlan` substitui a string. `appendAction` acrescenta `{ tool, args, observation }` sem mexer no plano. `appendBrief` acrescenta `{ next, brief }` na ordem. Duas chamadas de achados não alteram `plan` nem `actions` ([data-model.md](data-model.md))
- [X] T004 Em `src/team/blackboard.ts`, implementar `Blackboard`, `IncidentAction`, `emptyBlackboard`, `appendFindings`, `replacePlan`, `appendAction` e `appendBrief` até T003 passar. Funções puras, sem importar store, tool ou grafo

**Checkpoint**: Quadro testável sem modelo e sem rede

---

## Phase 3: User Story 1 - Turno coordenado por papéis (Priority: P1) 🎯 MVP

**Goal**: Com a rota `team`, o supervisor escolhe um papel por vez sobre o quadro. `fim` encerra e a resposta é o recado. Os outros modos não rodam. Cada decisão aceita vira `handoff` antes do papel.

**Independent Test**: `node --import tsx --test src/team/team-graph.test.ts` com supervisor e papéis fakes. Sem rede. A rota no grafo de produção: `node --import tsx --test src/graph/production-Graph.test.ts`.

### Tests for User Story 1

> Escrever primeiro; devem falhar até o grafo da equipe e o nó `team` existirem.

- [X] T005 [US1] Em `src/team/team-graph.test.ts`: supervisor fake devolve, em sequência, `analista`, `planejador`, `executor` e `fim`, cada um com `brief` não vazio. Cada papel roda uma vez e recebe o quadro já atualizado pelos anteriores (achados visíveis ao planejador, plano visível ao executor). A `answer` é o `brief` de `fim` aparado. O `trace` tem quatro `handoff` nessa ordem, todos com `node: "supervisor"`, e um `answer` final com `node: "supervisor"` e o mesmo texto. O primeiro `invoke` do supervisor recebe `user` com a mensagem do plantonista e o JSON do quadro vazio. `next: "outro"` ou `brief` só com espaços lança `ModelOutputError` e não chama papel. O mesmo papel escolhido duas vezes roda duas vezes, com dois `handoff` ([contracts/team-mode.md](contracts/team-mode.md))
- [X] T006 [P] [US1] Em `src/graph/production-Graph.test.ts`: o assert de `PRODUCTION_ROUTES` passa a esperar `["react", "planExecute", "reflect", "team"]`. Com `strategy: "team"` e as quatro strategies fakes, `visited` contém `team`, as outras três ficam com `runs` 0 e o `routeModel` não é chamado. Um fake `team` que devolve `{ type: "handoff", next: "fim", brief: "ok", node: "supervisor" }` conserva `node: "supervisor"` no trace (não vira `team`)

### Implementation for User Story 1

- [X] T007 [US1] Em `src/team/team-graph.ts`, implementar `runTeamGraph` / `teamStrategy` (`name: "team"`) com `StateGraph`: `START` → `supervisor` → papel nomeado → `supervisor`, e `fim` → `END`. Supervisor injetável (`invoke(messages) → { next, brief }`); sem injeção, `createModel().withStructuredOutput(supervisorSchema, { method: "functionCalling" })` com uma retentativa, no padrão de `invokeDefaultRouteModel` em `src/graph/production-Graph.ts`. Decisão inválida lança `ModelOutputError` no passo `"supervisor"` sem rodar papel. Cada decisão aceita faz `appendBrief`, emite o `handoff` e só então chama o papel injetado. O papel devolve texto de achados, plano ou ações e eventos já com `node` do papel; o grafo aplica só o campo daquele papel via `src/team/blackboard.ts` e concatena o trace. `fim` define `answer` = `brief` aparado e emite `answer` com `node: "supervisor"`. Ainda sem o nó `limite` (isso é T023). `ModelUnavailableError` propaga
- [X] T008 [US1] Em `src/graph/production-Graph.ts`: incluir `team` em `PRODUCTION_ROUTES`, no `StateSchema.route`, nas arestas condicionais e em `defaultStrategies` (`teamStrategy` de `src/team/team-graph.ts`). No nó da rota `team`, se o evento já tem `node`, mantê-lo; se não tem, usar `team`. Não alterar o carimbo de `react`, `planExecute` e `reflect`. Acrescentar a chave `team` em todo objeto `strategies` de `src/graph/production-Graph.test.ts`, `src/http/server.test.ts` e `src/services/run-chat.test.ts` (fake idle que conta `runs` onde o teste já conta as outras)

**Checkpoint**: US1 — ciclo fake até `fim`, resposta igual ao recado, só a rota `team` executa

---

## Phase 4: User Story 2 - Cada papel no seu limite (Priority: P1)

**Goal**: Analista só lê e só escreve achados. Planejador não tem ferramenta e só substitui o plano. Executor só invoca `open_incident` e `resolve_incident` depois do handoff, sem chegar no store.

**Independent Test**: `node --import tsx --test src/team/allowlist.test.ts src/team/roles.test.ts src/team/team-graph.test.ts`. Sem rede.

### Tests for User Story 2

- [X] T009 [P] [US2] Em `src/team/allowlist.test.ts`: `toolsFor("analista", tools)` devolve só `list_alerts`, `list_incidents`, `consultar_runbook`, `check_provider_status`, nessa ordem, mesmo que a lista traga `open_incident`, `resolve_incident` e `forget_preference`. `toolsFor("planejador", tools)` é `[]`. `toolsFor("executor", tools)` devolve só `open_incident` e `resolve_incident`
- [X] T010 [P] [US2] Em `src/team/roles.test.ts`: o runner do executor, com modelo fake que pede `open_incident` e também `list_alerts`, chama `invoke` só da tool `open_incident` presente na lista filtrada e devolve a observation em `actions`. Nome ausente dessa lista lança `ModelOutputError` e não chama `invoke` de uma tool homônima que esteja só na lista original. O runner do planejador não chama `bindTools` e exige `plan` não vazio. O runner do analista grava o texto em achados e, se o modelo pedir `list_alerts`, executa uma única leva e uma segunda chamada para o texto; não preenche `plan` nem `actions`
- [X] T011 [P] [US2] Em `src/team/team-graph.test.ts`: no ciclo de T005, o analista recebe só os quatro nomes de leitura, o planejador recebe lista vazia e o executor recebe só `open_incident` e `resolve_incident`. Supervisor que nunca escolhe `executor` deixa a spy de `open_incident` com zero `invoke`. O prompt `system` do supervisor contém `analista`, `planejador`, `executor` e `fim`

### Implementation for User Story 2

- [X] T012 [US2] Em `src/team/allowlist.ts`, implementar `toolsFor(role, tools)` com os três conjuntos de T009. Não importar `OpsStore` nem `executeOpenIncident`
- [X] T013 [US2] Em `src/team/roles.ts`, implementar os runners padrão de [contracts/team-mode.md](contracts/team-mode.md): analista e executor com no máximo uma leva de `tool_call` sobre a lista já filtrada (`tool.invoke`); planejador com `withStructuredOutput` de `{ plan: string }` sem `bindTools`. Chamada cujo nome não está na lista recebida lança `ModelOutputError`
- [X] T014 [US2] Em `src/team/team-graph.ts`, antes de cada papel, passar `toolsFor` do papel (a partir de `options.tools` ou, se ausente, `createDefaultOpsTools()`). Sem runner injetado, usar `src/team/roles.ts`. O `system` do supervisor descreve os limites: analista só leitura e não escreve plano nem ação; planejador sem ferramentas; executor só incidente pelas duas tools. Ignorar campo de escrita que não seja o do papel

**Checkpoint**: US2 — allowlist fechada, spy de incidente parada sem handoff `executor`

---

## Phase 5: User Story 3 - Handoff em "ver raciocínio" (Priority: P1)

**Goal**: O evento `handoff` aparece no trace textual e no painel, com `next` e `brief`, na ordem, sem novo pedido ao chat.

**Independent Test**: `node --import tsx --test src/agents/trace.test.ts` e `npm test --prefix web -- src/model/trace-lines.test.ts src/ui/WarRoom.test.tsx`.

### Tests for User Story 3

- [X] T015 [P] [US3] Em `src/agents/trace.test.ts`: `{ type: "handoff", next: "analista", brief: "ler alertas", node: "supervisor" }` vira a linha `[handoff] analista ler alertas`. Um trace misto mantém as linhas já cobertas de `thought`, `action`, `plan`, `route` e `answer`
- [X] T016 [P] [US3] Em `web/src/model/trace-lines.test.ts`: `presentTrace` de um `handoff` devolve `lines` `next` e `brief` com esses valores, e `node: "supervisor"`. Os casos já existentes de `thought`, `action`, `plan`, `route`, `fallback` e tipo desconhecido permanecem
- [X] T017 [P] [US3] Em `web/src/ui/WarRoom.test.tsx`: `200` fake cujo `trace` é um `thought` e depois um `handoff` (`next: "executor"`, `brief: "abrir incidente"`). "ver raciocínio" mostra `executor` e `abrir incidente` depois do conteúdo do `thought`. Fechar o botão deixa `fetch` no mesmo número de chamadas

### Implementation for User Story 3

- [X] T018 [P] [US3] Em `src/agents/trace.ts`, no `formatTrace`, serializar `handoff` como `[handoff] <next> <brief>` sem imprimir `node`. Não mudar o texto dos outros `type` ([contracts/handoff-trace.md](contracts/handoff-trace.md))
- [X] T019 [P] [US3] Em `web/src/model/trace-lines.ts`, no `linesFor`, quando `type === "handoff"` devolver `{ label: "next" }` e `{ label: "brief" }`. Não criar componente novo: `web/src/ui/TracePanel.tsx` já lista `lines`

**Checkpoint**: US3 — painel mostra o handoff e fechar não chama o chat

---

## Phase 6: User Story 4 - Rota `team` e teto 8 (Priority: P2)

**Goal**: O roteador pode escolher `team` e o cliente pode fixá-la. O oitavo handoff para um papel ainda executa esse papel e a resposta passa a ser a mensagem de limite. `fim` no oitavo usa o recado. `reflect: true` não oferece nem embrulha `team`.

**Independent Test**: Os três arquivos de T020–T022, sem rede. `strategy: "missing"` continua `422`.

### Tests for User Story 4

- [X] T020 [P] [US4] Em `src/team/team-graph.test.ts`: supervisor que sempre devolve `analista` com brief produz exatamente 8 `handoff`, o analista roda 8 vezes, não há nono `invoke` do supervisor e a `answer` é `LIMIT_ANSWER`. Supervisor que devolve `fim` no oitavo `invoke`: a `answer` é esse `brief` e não contém `Limite de iterações`
- [X] T021 [P] [US4] Em `src/graph/production-Graph.test.ts`: `ROUTER_PROMPT` contém a linha `team` e o trecho `papéis separados`, e ainda contém as linhas `react`, `planExecute` e `reflect`. Roteador fake `{ route: "team", reason: "equipe" }` executa só `team`, com evento `route` `override: false`. `strategy: "team"` não chama o roteador, `override: true` e `reason` igual a `OVERRIDE_REASON`. `reflect: true` com o modelo devolvendo `team` rejeita com `ModelOutputError`. `strategy: "team"` com `reflect: true` não produz evento `critique`
- [X] T022 [P] [US4] Em `src/http/server.test.ts`: `POST /chat` com `{ message, strategy: "team" }` responde `200`, o trace tem `route` `team` com `override: true`, e o `routeModel` fake não incrementa `calls`. `{ message, strategy: "missing" }` continua `422` com `UNKNOWN_STRATEGY` ([contracts/chat-http.md](contracts/chat-http.md))

### Implementation for User Story 4

- [X] T023 [US4] Em `src/team/team-graph.ts`, acrescentar o nó `limite`. Depois de um papel, se `handoffs < 8`, voltar ao `supervisor`; se `handoffs === 8`, ir a `limite` e `END` com `answer` = `LIMIT_ANSWER` e evento `answer` `node: "supervisor"`. `fim` no oitavo handoff encerra no supervisor com o `brief`, sem passar por `limite`
- [X] T024 [US4] Em `src/graph/production-Graph.ts`: acrescentar ao `SYSTEM_PROMPT` a linha `| team | o pedido precisa ler a situação, propor um plano e agir em incidente, com papéis separados |`. `allowedRoutes(true)` continua só `react` e `planExecute`. O nó de estratégia não aplica `withReflection` quando a rota é `team`

**Checkpoint**: US4 — teto 8, rota na tabela, override e `422` inalterado

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Fechar o gate da constituição e o quickstart.

- [X] T025 Rodar os comandos de [quickstart.md](quickstart.md) cenário 5: `npm run typecheck` e `npm run test` na raiz. Os dois terminam com sucesso. Confirmar que nenhum arquivo em `src/team/` importa `OpsStore`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: imediata. T001 e T002 em paralelo
- **Foundational (Phase 2)**: T003 depois pode seguir em paralelo com a Phase 1; T004 depende de T003
- **US1 (Phase 3)**: depende de T004 e T001. T005 e T006 em paralelo; T007 depende de T005; T008 depende de T006 e T007
- **US2 (Phase 4)**: depende de T007. T009, T010 e T011 em paralelo; T012 depende de T009; T013 depende de T010 e T012; T014 depende de T011 e T013
- **US3 (Phase 5)**: depende só de T001. Pode correr em paralelo com as Phases 2–4. T015, T016 e T017 em paralelo; T018 depende de T015; T019 depende de T016 e destrava T017
- **US4 (Phase 6)**: depende de T008 e T014. T020, T021 e T022 em paralelo; T023 depende de T020; T024 depende de T021
- **Polish (Phase 7)**: depende de T023, T024 e T019

### User Story Dependencies

- **US1 (P1)**: depois do quadro. Sem dependência das outras histórias
- **US2 (P1)**: integra no grafo da US1. O teste de allowlist (T009) não precisa do grafo
- **US3 (P1)**: independente do grafo. Usa o tipo criado em T001
- **US4 (P2)**: teto no grafo da US1 e rota no grafo da US1

### Parallel Opportunities

- T001 ∥ T002
- T005 ∥ T006
- T009 ∥ T010 ∥ T011
- T015 ∥ T016 ∥ T017, e essa fase inteira ∥ US1/US2
- T018 ∥ T019
- T020 ∥ T021 ∥ T022

---

## Parallel Example: User Story 3

```bash
# Testes do handoff, arquivos distintos:
# src/agents/trace.test.ts
# web/src/model/trace-lines.test.ts
# web/src/ui/WarRoom.test.tsx

# Implementação depois dos testes, arquivos distintos:
# src/agents/trace.ts
# web/src/model/trace-lines.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 e Phase 2
2. Phase 3 (US1)
3. Parar e validar: `node --import tsx --test src/team/team-graph.test.ts src/team/blackboard.test.ts` e o teste de exclusividade em `src/graph/production-Graph.test.ts`

### Incremental Delivery

1. US1 entrega o ciclo e a rota exclusiva
2. US2 fecha as ferramentas de cada papel
3. US3 mostra o handoff na war room (pode ir em paralelo com US1)
4. US4 liga o teto, a linha do roteador e o HTTP `strategy: "team"`
5. T025 confirma typecheck e a suíte inteira

### Parallel Team Strategy

1. Uma pessoa faz Phase 1 e Phase 2
2. Em seguida: pessoa A na US1, pessoa B na US3
3. US2 começa quando T007 existir; US4 quando T008 e T014 existirem

---

## Notes

- Testes desta feature são obrigatórios (FR-014 e constituição IV): escrever o teste, vê-lo falhar, depois implementar
- Não criar tabela SQLite nem campo novo em `POST /chat`
- Não embrulhar `team` com reflexão e não dar `OpsStore` ao executor
- O nó `limite` fica para T023; o ciclo da US1 sempre termina em `fim` nos testes de T005
