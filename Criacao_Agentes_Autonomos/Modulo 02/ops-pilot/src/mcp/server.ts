/**
 * Servidor MCP OpsPilot (stdio).
 * stdout = canal do protocolo; diagnóstico apenas em stderr.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  isDomainFailureJson,
  mcpOpsToolDefs,
} from "../agents/ops-tool-defs.js";
import { getDefaultOpsStore } from "../services/default-store.js";
import type { OpsStore } from "../store/ops-store.js";

export const MCP_SERVER_NAME = "opspilot";
export const MCP_SERVER_VERSION = "0.1.0";

/**
 * Fábrica testável: registra as 3 tools MCP sobre o store injetado.
 * Não conecta transporte e não escreve em stdout.
 */
export function createOpsMcpServer(store: OpsStore): McpServer {
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
  });

  for (const def of mcpOpsToolDefs) {
    server.registerTool(
      def.name,
      {
        description: def.description,
        inputSchema: def.schema.shape,
      },
      async (args) => {
        const text = await def.execute(store, args as Record<string, unknown>);
        return {
          content: [{ type: "text" as const, text }],
          isError: isDomainFailureJson(text),
        };
      },
    );
  }

  return server;
}

async function main(): Promise<void> {
  const store = await getDefaultOpsStore();
  const server = createOpsMcpServer(store);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("OpsPilot MCP server is running on stdio");
}

const isDirectRun =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("/src/mcp/server.ts") ||
    process.argv[1].endsWith("\\src\\mcp\\server.ts") ||
    process.argv[1].endsWith("/mcp/server.ts") ||
    process.argv[1].endsWith("\\mcp\\server.ts"));

if (isDirectRun) {
  main().catch((error) => {
    console.error(
      "OpsPilot MCP server failed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  });
}
