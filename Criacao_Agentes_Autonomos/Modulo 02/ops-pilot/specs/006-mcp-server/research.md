# Research: Servidor MCP OpsPilot

**Date**: 2026-09-17 | **Feature**: [spec.md](spec.md)

Nenhuma pendência de esclarecimento no Technical Context. Decisões abaixo alinham a spec, a constituição e o padrão atual de tools/store do OpsPilot.

## R1. Pacote MCP e transporte

- **Decision**: Usar `@modelcontextprotocol/sdk` (pedido explícito da feature), API high-level `McpServer` + `StdioServerTransport` de `server/mcp.js` e `server/stdio.js`. Nome do servidor: `opspilot`; version alinhada ao `package.json` do app (`0.1.0`).
- **Rationale**: Spec/assumptions pedem esse pacote e stdio para integração local (Cursor/IDE spawn). A API high-level registra tools com Zod e deriva JSON Schema.
- **Alternatives considered**: (a) `@modelcontextprotocol/server` v2: API mais nova, mas diverge do pedido e adiciona migração de pacotes; (b) Streamable HTTP: útil para remoto, fora do escopo stdio local.

## R2. Fonte única de verdade (schemas + comportamento)

- **Decision**: Extrair para `src/agents/ops-tool-defs.ts` as três defs MCP/agente:
  - `name`, `description` (texto das 6 regras já existente)
  - `schema` Zod idêntico ao de `tools.ts` hoje
  - `execute(store, args)` → string JSON (mesmo payload `{ alerts }` / `{ incident }` / erro `{ error: { code, message } }` via `DomainError`)
  
  `createOpsTools` monta `tool()` LangChain a partir dessas defs. O servidor MCP registra as mesmas defs via `server.tool` / `registerTool` com o mesmo `schema` e handler que chama `execute`.
- **Rationale**: Atende FR-004/SC-005 sem copiar Zod; mudança de schema propaga para agente e MCP.
- **Alternatives considered**: (a) MCP importa tools LangChain e adapta: acopla protocolo a `@langchain/core`; (b) schemas duplicados em `src/mcp/`: viola fonte única; (c) expor as 6 tools no MCP: fora do escopo v1 (FR-003).

## R3. Fábrica testável vs entrypoint stdio

- **Decision**:
  - `createOpsMcpServer(store: OpsStore): McpServer` — registra as 3 tools; **não** conecta transporte; **não** escreve em stdout.
  - `main` em `server.ts`: `await getDefaultOpsStore()`, `createOpsMcpServer(store)`, `connect(new StdioServerTransport())`.
  - Testes: criar server com `SqliteOpsStore(":memory:")` (+ seed se necessário) e listar tools via API do SDK (cliente + `InMemoryTransport` se disponível, ou inspeção da lista registrada / `listTools` in-process). **Não** spawnar processo stdio no teste mínimo se o SDK permitir verificação in-process.
- **Rationale**: FR-008 pede validar listagem; stdio real é difícil em unit test e arrisca misturar protocolo com asserts. Fábrica espelha o padrão HTTP (`createApp` + listen só no main).
- **Alternatives considered**: (a) só teste e2e spawnando `npm run mcp`: frágil e lento; (b) mockar stdout: mascara regressões de `console.log`.

## R4. Disciplina stdout / stderr

- **Decision**: Proibir `console.log`, `console.info`, `console.debug` e qualquer write em `process.stdout` fora do transport MCP no código do servidor. Diagnóstico permitido apenas com `console.error` / `process.stderr.write`. Não logar “server started” no stdout.
- **Rationale**: FR-006 / US3 — stdout é o canal JSON-RPC do MCP.
- **Alternatives considered**: (a) logger em arquivo: overkill para v1; (b) silêncio total sem stderr: dificulta debug operacional.

## R5. Script npm e env

- **Decision**: `"mcp": "tsx --env-file-if-exists=.env src/mcp/server.ts"` — mesmo padrão de `dev`/`seed`, para `OPSPILOT_DB` e demais env.
- **Rationale**: FR-007 e constituição V (sem dotenv).
- **Alternatives considered**: (a) `tsx src/mcp/server.ts` sem env: quebra quem depende de `.env` para o path do DB; (b) carregar dotenv no código: proibido pela constituição.

## R6. Resultado MCP das tools

- **Decision**: Handler MCP devolve `content: [{ type: "text", text: <mesma string JSON que a tool LangChain retorna> }]`. Em `DomainError`, mesma serialização `{ error: { code, message } }` (já usada em `tools.ts`); marcar `isError: true` quando for erro de domínio/validação, se a API do SDK permitir sem divergir do payload textual.
- **Rationale**: Paridade de observação entre agente e cliente MCP; cliente lê o mesmo JSON.
- **Alternatives considered**: (a) `structuredContent` apenas: ok como complemento futuro, mas o texto JSON garante paridade imediata; (b) throw no handler: risco de quebrar a sessão MCP.

## R7. Escopo das tools na listagem

- **Decision**: Registrar **somente** `list_alerts`, `open_incident`, `resolve_incident`. O teste de listagem asserta exatamente esse conjunto (ordem irrelevante; comparação por set/sort).
- **Rationale**: FR-003 / SC-001.
- **Alternatives considered**: registrar todas as 6 tools do agente: útil, mas fora da spec v1.

## R8. Dependência e peer Zod

- **Decision**: Adicionar `@modelcontextprotocol/sdk` em `dependencies`. Manter Zod 4 já presente (SDK declara peer `zod` ^3.25 || ^4).
- **Rationale**: Compatível com o stack atual.
- **Alternatives considered**: pinar Zod 3 só para MCP: regressão desnecessária.
