# Implementation Plan: Servidor MCP OpsPilot

**Branch**: `006-mcp-server` | **Date**: 2026-09-17 | **Spec**: [spec.md](spec.md)

## Summary

Expor as três tools operacionais de plantão (`list_alerts`, `open_incident`, `resolve_incident`) via um servidor MCP local nomeado `opspilot`, transporte stdio, reutilizando o mesmo `OpsStore` e os mesmos schemas Zod/descrições das tools do agente (fonte única de verdade). Script npm `mcp` inicia `src/mcp/server.ts`. Regra crítica: nenhum diagnóstico no stdout (canal do protocolo); stderr apenas.

## Technical Context

**Language/Version**: TypeScript ESM strict, Node.js 22 LTS

**Primary Dependencies**: `@modelcontextprotocol/sdk` (`McpServer`, `StdioServerTransport`), Zod 4 (já no projeto), `OpsStore` / `getDefaultOpsStore`

**Storage**: Mesmo SQLite embarcado (`OPSPILOT_DB`, default `./data/opspilot.db`); testes com `:memory:`

**Testing**: `node:test` via `tsx`; fábrica do servidor injetável + cliente MCP in-memory (ou equivalente) para `listTools` sem poluir stdout

**Target Platform**: Processo local spawnado por clientes MCP (Cursor/IDE/CLI)

**Project Type**: Backend / borda de protocolo (stdio), paralelo a HTTP/CLI

**Performance Goals**: Listagem de tools e invocações locais sobre store; sem SLA de rede

**Constraints**: Zero `console.log`/escrita diagnóstica no stdout; schemas não duplicados; escopo MCP v1 = exatamente 3 tools; env via flag nativa Node (sem dotenv)

**Scale/Scope**: 1 entrypoint MCP + extração leve de defs compartilhadas das 3 tools + 1 suíte de teste de listagem; demais tools do agente fora de escopo

## Constitution Check

*GATE: Passed before Phase 0 and rechecked after Phase 1 design.*

- [x] **I. Camadas explícitas**: MCP é nova borda (como HTTP/CLI); domínio permanece em `OpsStore` / handlers compartilhados; sem lógica de negócio no transporte.
- [x] **II. Validação na fronteira**: args das tools MCP usam os mesmos schemas Zod das tools do agente.
- [x] **III. Erros de domínio**: `DomainError` traduzido na borda MCP para resultado de tool (conteúdo de erro), sem vazar detalhes de transporte.
- [x] **IV. Teste é parte da tarefa**: teste automatizado sobe/instancia o server e valida `listTools`.
- [x] **V. Segurança por padrão**: sem dotenv; script com `--env-file-if-exists=.env`; sem segredos no repo.
- [x] **VI. Spec antes do código**: spec + este plano antes de implementar.
- [x] **VII. Persistência**: `getDefaultOpsStore()` / `SqliteOpsStore`; testes `:memory:`.

## Project Structure

### Documentation (this feature)

```text
specs/006-mcp-server/
├── checklists/requirements.md
├── contracts/mcp-tools.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
└── spec.md
```

### Source Code (repository root)

```text
src/
├── agents/
│   ├── ops-tool-defs.ts     # NOVO: schemas Zod + descrições + execute*() das 3 tools (fonte única)
│   ├── tools.ts             # createOpsTools consome ops-tool-defs (sem schemas duplicados)
│   └── tools.test.ts        # regressão das 6 tools do agente
├── mcp/
│   ├── server.ts            # entrypoint: createOpsMcpServer + connect StdioServerTransport
│   └── server.test.ts       # listTools = list_alerts, open_incident, resolve_incident
├── services/
│   └── default-store.ts     # reuso getDefaultOpsStore
└── store/
    └── ops-store.ts         # contrato OpsStore (inalterado)
package.json                 # script "mcp": "tsx --env-file-if-exists=.env src/mcp/server.ts"
```

**Structure Decision**: Projeto único. Extrair defs das três tools para `src/agents/ops-tool-defs.ts` (schemas, descriptions, execute contra `OpsStore`). `tools.ts` (LangChain) e `src/mcp/server.ts` (MCP) consomem essa fonte. Entrypoint MCP conecta stdio apenas no `main`; testes usam a fábrica sem stdio.

## Phase 0: Research

Decisões em [research.md](research.md): SDK `@modelcontextprotocol/sdk` + stdio; extração de defs compartilhadas; fábrica testável; política stdout/stderr; script npm com env; escopo de 3 tools.

## Phase 1: Design & Contracts

- Modelo / fluxos: [data-model.md](data-model.md)
- Contrato MCP das 3 tools: [contracts/mcp-tools.md](contracts/mcp-tools.md)
- Validação executável: [quickstart.md](quickstart.md)

## Implementation Sequence

1. Extrair schemas, descriptions e `execute*` das três tools para `src/agents/ops-tool-defs.ts`; atualizar `createOpsTools` para consumir essa fonte (sem mudança de comportamento das 6 tools).
2. Adicionar dependência `@modelcontextprotocol/sdk`.
3. Implementar `createOpsMcpServer(store)` em `src/mcp/server.ts` registrando só as 3 tools; `main` usa `getDefaultOpsStore()` + `StdioServerTransport`; diagnóstico só via `console.error` / stderr.
4. Script npm `mcp` com `--env-file-if-exists=.env`.
5. Teste `src/mcp/server.test.ts`: instancia servidor (store `:memory:`), valida listagem das 3 tools (nomes exatos).
6. `npm run typecheck` e `npm run test` verdes.

## Complexity Tracking

Nenhuma violação constitucional requer justificativa.
