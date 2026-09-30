import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  executeListAlerts,
  executeOpenIncident,
  executeResolveIncident,
  MCP_OPS_TOOL_NAMES,
} from "../agents/ops-tool-defs.js";
import { SqliteOpsStore } from "../store/sqlite-ops-store.js";
import {
  createOpsMcpServer,
  MCP_SERVER_NAME,
} from "./server.js";

async function makeSeededStore() {
  const store = new SqliteOpsStore(":memory:");
  await store.seedMercado();
  return store;
}

async function connectTestClient(store: SqliteOpsStore) {
  const server = createOpsMcpServer(store);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "ops-pilot-test", version: "0.0.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}

describe("OpsPilot MCP server", () => {
  it("lista exatamente list_alerts, open_incident e resolve_incident", async () => {
    const store = await makeSeededStore();
    const { client, server } = await connectTestClient(store);

    const listed = await client.listTools();
    const names = listed.tools.map((t) => t.name).sort();

    assert.deepEqual(names, [...MCP_OPS_TOOL_NAMES].sort());
    assert.equal(names.length, 3);

    await client.close();
    await server.close();
  });

  it("expõe servidor nomeado opspilot", async () => {
    const store = await makeSeededStore();
    const server = createOpsMcpServer(store);
    assert.equal(MCP_SERVER_NAME, "opspilot");
    // McpServer guarda Implementation no server interno
    const impl = (server as unknown as { server: { _serverInfo?: { name: string } } })
      .server;
    assert.ok(impl);
    await server.close();
  });

  it("execute das 3 tools opera sobre o mesmo OpsStore", async () => {
    const store = await makeSeededStore();

    const listed = JSON.parse(await executeListAlerts(store, {})) as {
      alerts: unknown[];
    };
    assert.ok(Array.isArray(listed.alerts));
    assert.ok(listed.alerts.length > 0);

    const opened = JSON.parse(
      await executeOpenIncident(store, {
        title: "MCP test incident",
        service: "checkout",
        severity: "high",
      }),
    ) as { incident: { id: number; status: string } };
    assert.equal(opened.incident.status, "open");

    const resolved = JSON.parse(
      await executeResolveIncident(store, { id: opened.incident.id }),
    ) as { incident: { status: string } };
    assert.equal(resolved.incident.status, "resolved");
  });

  it("callTool via MCP devolve JSON de list_alerts", async () => {
    const store = await makeSeededStore();
    const { client, server } = await connectTestClient(store);

    const result = await client.callTool({
      name: "list_alerts",
      arguments: {},
    });
    const text =
      Array.isArray(result.content) && result.content[0]?.type === "text"
        ? result.content[0].text
        : "";
    const parsed = JSON.parse(text) as { alerts: unknown[] };
    assert.ok(Array.isArray(parsed.alerts));

    await client.close();
    await server.close();
  });

  it("módulo do server não usa console.log (stdout reservado ao protocolo)", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, "server.ts"), "utf8");
    assert.equal(
      /console\.log\s*\(/.test(source),
      false,
      "src/mcp/server.ts não deve conter console.log",
    );
    assert.equal(
      /console\.(info|debug)\s*\(/.test(source),
      false,
      "src/mcp/server.ts não deve conter console.info/debug",
    );
    assert.match(source, /console\.error/);
  });
});
