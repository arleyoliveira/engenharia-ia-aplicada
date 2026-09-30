import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toolsFor, type NamedTool } from "./allowlist.js";

function tool(name: string): NamedTool {
  return { name, async invoke() { return ""; } };
}

const ALL = [
  "forget_preference",
  "open_incident",
  "list_alerts",
  "resolve_incident",
  "consultar_runbook",
  "list_incidents",
  "check_provider_status",
].map(tool);

describe("toolsFor", () => {
  it("filtra leitura, plano vazio e incidente", () => {
    assert.deepEqual(
      toolsFor("analista", ALL).map((item) => item.name),
      ["list_alerts", "list_incidents", "consultar_runbook", "check_provider_status"],
    );
    assert.deepEqual(toolsFor("planejador", ALL), []);
    assert.deepEqual(
      toolsFor("executor", ALL).map((item) => item.name),
      ["open_incident", "resolve_incident"],
    );
  });
});
