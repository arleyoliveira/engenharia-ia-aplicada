import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ModelOutputError } from "../errors.js";
import type { NamedTool } from "./allowlist.js";
import { LIMIT_ANSWER, SUPERVISOR_PROMPT, runTeamGraph, type SupervisorModel } from "./team-graph.js";

function scripted(sequence: { next: string; brief: string }[]): SupervisorModel & {
  calls: number;
  messages: ReadonlyArray<readonly [string, string]>[];
} {
  const model = {
    calls: 0,
    messages: [] as ReadonlyArray<readonly [string, string]>[],
    async invoke(messages: ReadonlyArray<readonly [string, string]>) {
      model.calls += 1;
      model.messages.push(messages);
      const verdict = sequence[model.calls - 1];
      if (!verdict) {
        return { next: "analista", brief: "de novo" };
      }
      return verdict;
    },
  };
  return model;
}

function role(name: string, write: "findings" | "plan" | "actions") {
  const seen: { brief: string; text: string; tools: string[] }[] = [];
  return {
    seen,
    async run(ctx: { brief: string; blackboardText: string; tools: readonly NamedTool[] }) {
      seen.push({
        brief: ctx.brief,
        text: ctx.blackboardText,
        tools: ctx.tools.map((item) => item.name),
      });
      if (write === "findings") {
        return { findings: `achado ${seen.length}`, trace: [{ type: "thought" as const, content: "li", node: "analista" as const }] };
      }
      if (write === "plan") {
        return { plan: "1. abrir", trace: [{ type: "plan" as const, steps: ["1. abrir"], node: "planejador" as const }] };
      }
      return {
        actions: [{ tool: "open_incident" as const, args: { title: "checkout" }, observation: "aberto" }],
        trace: [{ type: "action" as const, tool: "open_incident", args: { title: "checkout" }, node: "executor" as const }],
      };
    },
  };
}

function catalog(): NamedTool[] {
  return [
    "forget_preference",
    "list_alerts",
    "list_incidents",
    "consultar_runbook",
    "check_provider_status",
    "open_incident",
    "resolve_incident",
  ].map((name) => ({ name, async invoke() { return "{}"; } }));
}

describe("team graph", () => {
  it("percorre analista, planejador, executor e encerra em done", async () => {
    const supervisor = scripted([
      { next: "analista", brief: "ler alertas" },
      { next: "planejador", brief: "propor plano" },
      { next: "executor", brief: "abrir incidente" },
      { next: "done", brief: "incidente aberto no checkout" },
    ]);
    const analista = role("analista", "findings");
    const planejador = role("planejador", "plan");
    const executor = role("executor", "actions");
    const result = await runTeamGraph(
      { message: "status do checkout", tools: catalog() },
      {
        supervisor,
        roles: { analista: analista.run, planejador: planejador.run, executor: executor.run },
      },
    );

    assert.equal(analista.seen.length, 1);
    assert.equal(planejador.seen.length, 1);
    assert.equal(executor.seen.length, 1);
    assert.match(planejador.seen[0]?.text ?? "", /achado 1/);
    assert.match(executor.seen[0]?.text ?? "", /1\. abrir/);
    assert.equal(result.answer, "incidente aberto no checkout");
    assert.deepEqual(
      result.trace.filter((event) => event.type === "handoff").map((event) => event.type === "handoff" ? event.to : ""),
      ["analista", "planejador", "executor", "done"],
    );
    assert.ok(result.trace.filter((event) => event.type === "handoff").every((event) => event.type === "handoff" && event.from === "supervisor" && event.node === "supervisor"));
    const answer = result.trace.at(-1);
    assert.equal(answer?.type, "answer");
    if (answer?.type === "answer") {
      assert.equal(answer.content, "incidente aberto no checkout");
      assert.equal(answer.node, "supervisor");
    }
    const first = supervisor.messages[0];
    assert.equal(first?.[0]?.[0], "system");
    assert.equal(first?.[0]?.[1], SUPERVISOR_PROMPT);
    assert.match(SUPERVISOR_PROMPT, /analista/);
    assert.match(SUPERVISOR_PROMPT, /planejador/);
    assert.match(SUPERVISOR_PROMPT, /executor/);
    assert.match(SUPERVISOR_PROMPT, /done/);
    assert.equal(first?.[1]?.[0], "user");
    assert.match(first?.[1]?.[1] ?? "", /status do checkout/);
    assert.match(first?.[1]?.[1] ?? "", /\(vazio\)/);
    assert.deepEqual(analista.seen[0]?.tools, [
      "list_alerts",
      "list_incidents",
      "consultar_runbook",
      "check_provider_status",
    ]);
    assert.deepEqual(planejador.seen[0]?.tools, []);
    assert.deepEqual(executor.seen[0]?.tools, ["open_incident", "resolve_incident"]);
  });

  it("rejeita next ou brief inválidos sem chamar papel", async () => {
    const analista = role("analista", "findings");
    await assert.rejects(
      () =>
        runTeamGraph(
          { message: "status", tools: [] },
          {
            supervisor: scripted([{ next: "outro", brief: "x" }]),
            roles: { analista: analista.run },
          },
        ),
      ModelOutputError,
    );
    await assert.rejects(
      () =>
        runTeamGraph(
          { message: "status", tools: [] },
          {
            supervisor: scripted([{ next: "analista", brief: "   " }]),
            roles: { analista: analista.run },
          },
        ),
      ModelOutputError,
    );
    assert.equal(analista.seen.length, 0);
  });

  it("repete o mesmo papel quando o supervisor pede de novo", async () => {
    const analista = role("analista", "findings");
    await runTeamGraph(
      { message: "status", tools: catalog() },
      {
        supervisor: scripted([
          { next: "analista", brief: "primeira" },
          { next: "analista", brief: "segunda" },
          { next: "done", brief: "fim" },
        ]),
        roles: { analista: analista.run },
      },
    );
    assert.equal(analista.seen.length, 2);
    assert.match(analista.seen[1]?.text ?? "", /achado 1/);
  });

  it("não invoca incidente sem handoff do executor", async () => {
    const incident = { invokes: 0, name: "open_incident", async invoke() { incident.invokes += 1; return "{}"; } };
    const executor = role("executor", "actions");
    await runTeamGraph(
      { message: "status", tools: [incident] },
      {
        supervisor: scripted([
          { next: "analista", brief: "ler" },
          { next: "done", brief: "só leitura" },
        ]),
        roles: {
          analista: async () => ({ findings: "nada firing", trace: [] }),
          executor: executor.run,
        },
      },
    );
    assert.equal(incident.invokes, 0);
    assert.equal(executor.seen.length, 0);
  });

  it("para no oitavo handoff de papel e aceita done no oitavo", async () => {
    const analista = role("analista", "findings");
    const limited = await runTeamGraph(
      { message: "status", tools: [] },
      {
        supervisor: {
          async invoke() {
            return { next: "analista", brief: "de novo" };
          },
        },
        roles: { analista: analista.run },
      },
    );
    const handoffs = limited.trace.filter((event) => event.type === "handoff");
    assert.equal(handoffs.length, 8);
    assert.equal(analista.seen.length, 8);
    assert.equal(limited.answer, LIMIT_ANSWER);

    let calls = 0;
    const closed = await runTeamGraph(
      { message: "status", tools: [] },
      {
        supervisor: {
          async invoke() {
            calls += 1;
            if (calls < 8) {
              return { next: "analista", brief: `passo ${calls}` };
            }
            return { next: "done", brief: "resumo final" };
          },
        },
        roles: { analista: analista.run },
      },
    );
    assert.equal(closed.answer, "resumo final");
    assert.equal(closed.answer.includes("Limite de iterações"), false);
  });
});
