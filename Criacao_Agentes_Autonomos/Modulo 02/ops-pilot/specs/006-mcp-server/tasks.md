---

description: "Task list for OpsPilot MCP server (stdio)"
---

# Tasks: Servidor MCP OpsPilot

**Input**: Design documents from `/specs/006-mcp-server/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, constitution

**Tests**: Spec exige teste automatizado que instancia o server e valida a listagem das 3 tools (FR-008 / US1).

**Organization**: Tarefas por história de usuário. Sketch do implement: `McpServer` + `registerTool` + `StdioServerTransport` + `console.error` no stderr.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo
- **[Story]**: US1 / US2 / US3
- Incluir caminhos de arquivo exatos

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependência MCP e esqueleto de arquivos.

- [X] T001 Adicionar `@modelcontextprotocol/sdk` em `package.json` / `npm install`
- [X] T002 [P] Criar esqueleto `src/agents/ops-tool-defs.ts` (exports planejados para as 3 defs)
- [X] T003 [P] Criar esqueleto `src/mcp/server.ts` com `createOpsMcpServer` + `main` (sem tools ainda)
- [X] T004 [P] Adicionar script `"mcp": "tsx --env-file-if-exists=.env src/mcp/server.ts"` em `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Fonte única de verdade e fábrica MCP — bloqueia todas as histórias.

**⚠️ CRITICAL**: Nenhuma história começa antes desta fase

- [X] T005 Extrair schemas Zod, descriptions e `execute*` de `list_alerts`, `open_incident`, `resolve_incident` para `src/agents/ops-tool-defs.ts`
- [X] T006 Refatorar `src/agents/tools.ts` para consumir `ops-tool-defs` (comportamento das 6 tools inalterado)
- [X] T007 Implementar `createOpsMcpServer(store)` em `src/mcp/server.ts` registrando as 3 tools via `registerTool` (schemas/handlers de `ops-tool-defs`); nome `opspilot`; sem `console.log`
- [X] T008 Wire `main` em `src/mcp/server.ts`: `getDefaultOpsStore()` + `StdioServerTransport` + `console.error` só no stderr

**Checkpoint**: Foundation pronta — defs compartilhadas + servidor MCP registrável

---

## Phase 3: User Story 1 - Descobrir tools via MCP (Priority: P1) 🎯 MVP

**Goal**: Cliente lista exatamente `list_alerts`, `open_incident`, `resolve_incident`; servidor `opspilot`.

**Independent Test**: `npm run test -- src/mcp/server.test.ts` valida listagem.

### Tests for User Story 1

- [X] T009 [P] [US1] Escrever `src/mcp/server.test.ts`: instancia `createOpsMcpServer` com store `:memory:`, valida set das 3 tools

### Implementation for User Story 1

- [X] T010 [US1] Garantir `listTools` / introspecção expõe as 3 tools com nomes e schemas da fonte única em `src/mcp/server.ts`
- [X] T011 [US1] Confirmar regressão `src/agents/tools.test.ts` ainda passa após extração

**Checkpoint**: US1 — listagem MCP verde

---

## Phase 4: User Story 2 - Operações pelo mesmo store (Priority: P2)

**Goal**: Invocar as 3 tools via handlers MCP com paridade de JSON ao agente.

**Independent Test**: Handlers/`execute` com `:memory:` abrem/listam/resolvem como as tools LangChain.

### Tests for User Story 2

- [X] T012 [P] [US2] Em `src/mcp/server.test.ts` (ou teste de defs), cobrir `execute` das 3 tools sobre `SqliteOpsStore(":memory:")` com seed

### Implementation for User Story 2

- [X] T013 [US2] Handlers MCP devolvem `content: [{ type: "text", text: json }]` e `isError` em DomainFailure em `src/mcp/server.ts`
- [X] T014 [US2] Erros de domínio serializados via mesmo `failurePayload` em `src/agents/ops-tool-defs.ts`

**Checkpoint**: US2 — paridade store/JSON

---

## Phase 5: User Story 3 - Canal stdio íntegro (Priority: P3)

**Goal**: Zero diagnóstico no stdout; stderr ok.

**Independent Test**: Código do server sem `console.log`; bootstrap usa `console.error`.

### Implementation for User Story 3

- [X] T015 [US3] Auditar `src/mcp/server.ts` — nenhum `console.log`/`info`/`debug`; só `console.error` se diagnóstico
- [X] T016 [P] [US3] Assert em `src/mcp/server.test.ts` (grep estático ou regra) que o módulo não chama `console.log`

**Checkpoint**: US3 — stdout limpo

---

## Phase 6: Polish & Cross-Cutting

- [X] T017 Rodar `npm run typecheck` e `npm run test`
- [X] T018 [P] Validar quickstart cenário 1 (`npm run test -- src/mcp/server.test.ts`)
- [X] T019 Verificar `.gitignore` cobre `node_modules/`, `.env*`, `data/`

---

## Dependencies & Execution Order

- Setup → Foundational → US1 → US2 → US3 → Polish
- US1 é MVP (listagem)
- Sketch do usuário: padrão `registerTool` + stderr; nome canônico `opspilot` (não `opspilot-mcp`); severity inclui `critical`; store via objeto `{ title, service, severity }`

## MVP

Phases 1–3 (T001–T011): servidor sobe, listTools ok, script `mcp` disponível.
