import { describe, expect, it } from "vitest";
import { presentTrace } from "./trace-lines";

describe("presentTrace", () => {
  it("mostra os campos de cada tipo e conserva o vizinho desconhecido", () => {
    expect(presentTrace([{ type: "thought", content: "ideia", node: "planner" }])[0]).toEqual({
      type: "thought",
      node: "planner",
      lines: [{ label: "content", value: "ideia" }],
    });
    for (const type of ["observation", "critique", "summarize", "answer"]) {
      expect(presentTrace([{ type, content: "texto" }])[0]?.lines).toEqual([
        { label: "content", value: "texto" },
      ]);
    }
    expect(presentTrace([{ type: "action", tool: "list_alerts", args: { service: "billing" } }])[0]?.lines).toEqual([
      { label: "tool", value: "list_alerts" },
      { label: "args", value: JSON.stringify({ service: "billing" }) },
    ]);
    expect(presentTrace([{ type: "plan", steps: ["um", "dois"] }])[0]?.lines).toEqual([
      { label: "steps", value: "um" },
      { label: "steps", value: "dois" },
    ]);
    expect(presentTrace([{
      type: "route",
      route: "react",
      reason: "curta",
      override: false,
      node: "roteador",
    }])[0]).toEqual({
      type: "route",
      node: "roteador",
      lines: [
        { label: "route", value: "react" },
        { label: "reason", value: "curta" },
        { label: "override", value: "não" },
      ],
    });
    expect(presentTrace([{ type: "route", route: "react", reason: "curta", override: true }])[0]?.lines[2]).toEqual({
      label: "override",
      value: "sim",
    });
    expect(presentTrace([{ type: "fallback", from: "a", to: "b" }])[0]?.lines).toEqual([
      { label: "from", value: "a" },
      { label: "to", value: "b" },
    ]);
    expect(presentTrace([{
      type: "handoff",
      from: "supervisor",
      to: "executor",
      brief: "abrir incidente",
      node: "supervisor",
    }])[0]).toEqual({
      type: "handoff",
      node: "supervisor",
      lines: [
        { label: "from", value: "supervisor" },
        { label: "to", value: "executor" },
        { label: "brief", value: "abrir incidente" },
      ],
    });
    expect(presentTrace([{ type: "thought", content: "x", node: "" }])[0]?.node).toBeUndefined();

    const mixed = presentTrace([
      { type: "thought", content: "ok" },
      { type: "custom", foo: 1 },
      { type: "answer", content: "fim" },
    ]);
    expect(mixed).toHaveLength(3);
    expect(mixed[1]?.lines).toEqual([{
      label: "evento",
      value: JSON.stringify({ type: "custom", foo: 1 }),
    }]);
    expect(presentTrace([])).toEqual([]);
  });
});
