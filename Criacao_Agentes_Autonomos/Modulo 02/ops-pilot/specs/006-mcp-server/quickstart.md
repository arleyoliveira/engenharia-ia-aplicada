# Quickstart: Servidor MCP OpsPilot

Validação do contrato em [contracts/mcp-tools.md](contracts/mcp-tools.md). Modelo: [data-model.md](data-model.md).

## Pré-requisitos

- Node.js 22 LTS e dependências instaladas (`npm install`), incluindo `@modelcontextprotocol/sdk`.
- Credenciais de modelo **não** são necessárias para os testes desta feature.
- Opcional: `.env` com `OPSPILOT_DB` para persistência em arquivo ao rodar `npm run mcp`.

## Cenário 1 - Teste de listagem de tools (obrigatório)

```bash
npm run test -- src/mcp/server.test.ts
```

**Esperado**:

- Servidor criado via fábrica com store `:memory:` (ou equivalente injetável).
- Listagem contém exatamente `list_alerts`, `open_incident`, `resolve_incident` (comparar por conjunto).
- Nenhuma escrita diagnóstica exigida no stdout pelo teste.

## Cenário 2 - Regressão das tools do agente + typecheck

```bash
npm run test -- src/agents/tools.test.ts
npm run typecheck
```

**Esperado**: as 6 tools do agente continuam verdes após a extração de `ops-tool-defs`; typecheck sem erros.

## Cenário 3 - Subir o servidor localmente (manual)

```bash
npm run mcp
```

**Esperado**:

- Processo fica à espera de mensagens MCP em stdin (sem banner/`console.log` no stdout).
- Em cliente MCP (ex.: Cursor), configurar comando `npm run mcp` (cwd = raiz do projeto); descoberta mostra as 3 tools e nome `opspilot`.
- Diagnósticos, se houver, só em stderr.

## Cenário 4 - Invocação manual opcional (cliente MCP)

Com o server conectado ao cliente:

1. `list_alerts` sem filtro → JSON com `alerts`.
2. `open_incident` com title/service/severity válidos → `incident` open.
3. `resolve_incident` com o `id` retornado → `incident` resolved.

**Esperado**: mesmos payloads JSON das tools do agente sobre o mesmo DB (`OPSPILOT_DB` ou default).
