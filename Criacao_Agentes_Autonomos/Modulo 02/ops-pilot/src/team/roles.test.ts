import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ModelOutputError } from "../errors.js";
import type { NamedTool } from "./allowlist.js";
import { runAnalyst, runExecutor, runPlanner } from "./roles.js";

function spy(name: string): NamedTool & { invokes: unknown[] } {
  const tool = {
    name,
    invokes: [] as unknown[],
    async invoke(args: unknown) {
      tool.invokes.push(args);
      return `{"ok":"${name}"}`;
    },
  };
  return tool;
}

describe("roles", () => {
  it("executor invoca só a tool da lista filtrada", async () => {
    const open = spy("open_incident");
    const leaked = spy("list_alerts");
    let bound: string[] = [];
    const turn = await runExecutor(
      {
        message: "abrir",
        brief: "abrir incidente no checkout",
        blackboardText: "Plano:\n1. abrir",
        tools: [open],
      },
      {
        bindTools(tools) {
          bound = tools.map((item) => item.name);
          return {
            async invoke() {
              return {
                tool_calls: [{ name: "open_incident", args: { title: "checkout" } }],
              };
            },
          };
        },
        async invoke() {
          return {};
        },
      },
    );
    assert.deepEqual(bound, ["open_incident"]);
    assert.equal(open.invokes.length, 1);
    assert.equal(leaked.invokes.length, 0);
    assert.equal(turn.actions?.length, 1);
    await assert.rejects(
      () =>
        runExecutor(
          {
            message: "abrir",
            brief: "abrir",
            blackboardText: "",
            tools: [open],
          },
          {
            bindTools() {
              return {
                async invoke() {
                  return { tool_calls: [{ name: "list_alerts", args: {} }] };
                },
              };
            },
            async invoke() {
              return {};
            },
          },
        ),
      ModelOutputError,
    );
    assert.equal(leaked.invokes.length, 0);
  });

  it("planejador não chama bindTools e exige plano", async () => {
    let bound = false;
    const model = {
      bindTools() {
        bound = true;
        return { async invoke() { return {}; } };
      },
      withStructuredOutput() {
        return { async invoke() { return { plan: "1. abrir incidente" }; } };
      },
    };
    const turn = await runPlanner(
      { message: "plano", brief: "propor", blackboardText: "Achados:\nfiring", tools: [] },
      model,
    );
    assert.equal(bound, false);
    assert.equal(turn.plan, "1. abrir incidente");
    assert.equal(turn.trace[0]?.type, "plan");
    await assert.rejects(
      () =>
        runPlanner(
          { message: "plano", brief: "propor", blackboardText: "", tools: [] },
          {
            withStructuredOutput() {
              return { async invoke() { return { plan: "  " }; } };
            },
          },
        ),
      ModelOutputError,
    );
  });

  it("analista grava achados e faz uma leva de leitura", async () => {
    const alerts = spy("list_alerts");
    let invokes = 0;
    const turn = await runAnalyst(
      {
        message: "status",
        brief: "ler alertas",
        blackboardText: "Achados:\n(vazio)",
        tools: [alerts],
      },
      {
        bindTools() {
          return {
            async invoke() {
              invokes += 1;
              return { tool_calls: [{ name: "list_alerts", args: { status: "firing" } }] };
            },
          };
        },
        async invoke() {
          invokes += 1;
          return { content: "alerta firing no checkout" };
        },
      },
    );
    assert.equal(invokes, 2);
    assert.equal(alerts.invokes.length, 1);
    assert.equal(turn.findings, "alerta firing no checkout");
    assert.equal(turn.plan, undefined);
    assert.equal(turn.actions, undefined);
  });
});
