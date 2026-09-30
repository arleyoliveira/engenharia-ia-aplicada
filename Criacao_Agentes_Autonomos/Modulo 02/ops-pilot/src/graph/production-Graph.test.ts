import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ModelOutputError, ModelUnavailableError } from "../errors.js";
import type {
  ReasoningStrategy,
  StrategyInput,
  TraceEvent,
} from "../agents/types.js";
import { DEFAULT_SECTION_BUDGETS } from "../context/context-builder.js";
import {
  OVERRIDE_REASON,
  PRODUCTION_ROUTES,
  ROUTER_PROMPT,
  runProductionGraph,
  type ProductionRoute,
  type RouteModel,
} from "./production-Graph.js";

function fakeStrategy(
  name: string,
  events?: TraceEvent[],
): ReasoningStrategy & { runs: number; lastInput: StrategyInput | null } {
  const strategy = {
    name,
    runs: 0,
    lastInput: null as StrategyInput | null,
    async run(input: StrategyInput) {
      strategy.runs += 1;
      strategy.lastInput = input;
      const message = typeof input === "string" ? input : input.message;
      return {
        answer: `${name}:${message}`,
        trace: events ?? [{ type: "answer" as const, content: `${name}:${message}` }],
        metrics: { llmCalls: 0, latencyMs: 1, promptTokens: 0 },
      };
    },
  };
  return strategy;
}

function strategiesFor(
  routes: Partial<Record<ProductionRoute, ReturnType<typeof fakeStrategy>>> &
    Pick<Record<ProductionRoute, ReturnType<typeof fakeStrategy>>, "react" | "planExecute" | "reflect">,
): Record<ProductionRoute, ReturnType<typeof fakeStrategy>> {
  return {
    team: fakeStrategy("team"),
    ...routes,
  };
}

function routeModel(
  verdict: { route: string; reason: string } | (() => Promise<{ route: string; reason: string }>),
): RouteModel & { calls: number; messages: { role: string; content: string }[][] } {
  const model = {
    calls: 0,
    messages: [] as { role: string; content: string }[][],
    async invoke(messages: readonly { role: string; content: string }[]) {
      model.calls += 1;
      model.messages.push([...messages]);
      if (typeof verdict === "function") {
        return verdict();
      }
      return verdict;
    },
  };
  return model;
}

function baseInput(overrides?: Partial<Parameters<typeof runProductionGraph>[0]>) {
  return {
    message: "status do checkout",
    history: [],
    memories: [],
    budgets: DEFAULT_SECTION_BUDGETS,
    ...overrides,
  };
}

describe("production graph", () => {
  it("exporta as três rotas e o motivo de override", () => {
    assert.deepEqual(PRODUCTION_ROUTES, ["react", "planExecute", "reflect", "team"]);
    assert.equal(OVERRIDE_REASON, "estratégia informada pelo cliente");
    assert.match(ROUTER_PROMPT, /\| react \|/);
    assert.match(ROUTER_PROMPT, /\| planExecute \|/);
    assert.match(ROUTER_PROMPT, /\| reflect \|/);
    assert.match(ROUTER_PROMPT, /poucas iterações/);
    assert.match(ROUTER_PROMPT, /plano explícito/);
    assert.match(ROUTER_PROMPT, /revisão crítica/);
    assert.match(ROUTER_PROMPT, /\| team \|/);
    assert.match(ROUTER_PROMPT, /papéis separados/);
  });

  it("visita context, roteador, uma estratégia e resposta", async () => {
    const react = fakeStrategy("react");
    const planExecute = fakeStrategy("planExecute");
    const reflect = fakeStrategy("reflect");
    const router = routeModel({ route: "react", reason: "consulta curta" });
    const long = "antiga ".repeat(40);
    const result = await runProductionGraph(
      baseInput({
        history: [
          { role: "user", content: long },
          { role: "assistant", content: "NEW" },
        ],
        memories: [
          { fact: "baixo", score: 0.1 },
          { fact: "alto", score: 0.9 },
        ],
        summary: "resumo longo demais ".repeat(30),
        budgets: { summary: 2, window: 1, memories: 1 },
      }),
      {
        strategies: strategiesFor({ react, planExecute, reflect }),
        routeModel: router,
      },
    );

    assert.deepEqual(result.visited, ["context", "roteador", "react", "resposta"]);
    assert.equal(react.runs, 1);
    assert.equal(planExecute.runs, 0);
    assert.equal(reflect.runs, 0);
    assert.ok(react.lastInput && typeof react.lastInput !== "string");
    assert.deepEqual(react.lastInput.history, [{ role: "assistant", content: "NEW" }]);
    assert.deepEqual(react.lastInput.memories, ["alto"]);
    assert.ok(react.lastInput.summary);
    assert.equal(result.answer, "react:status do checkout");
  });

  it("executa só a rota devolvida pelo roteador", async () => {
    for (const route of PRODUCTION_ROUTES) {
      const react = fakeStrategy("react");
      const planExecute = fakeStrategy("planExecute");
      const reflect = fakeStrategy("reflect");
      const result = await runProductionGraph(baseInput(), {
        strategies: strategiesFor({ react, planExecute, reflect }),
        routeModel: routeModel({ route, reason: `escolheu ${route}` }),
      });
      assert.equal(react.runs, route === "react" ? 1 : 0);
      assert.equal(planExecute.runs, route === "planExecute" ? 1 : 0);
      assert.equal(reflect.runs, route === "reflect" ? 1 : 0);
      assert.equal(result.visited[2], route);
    }
  });

  it("envia a tabela no prompt e grava o evento route", async () => {
    const react = fakeStrategy("react");
    const router = routeModel({ route: "react", reason: "consulta curta" });
    const result = await runProductionGraph(baseInput(), {
      strategies: strategiesFor({
        react,
        planExecute: fakeStrategy("planExecute"),
        reflect: fakeStrategy("reflect"),
      }),
      routeModel: router,
    });

    assert.equal(router.calls, 1);
    const sent = router.messages[0];
    assert.ok(sent);
    assert.equal(sent[0]?.role, "system");
    assert.equal(sent[0]?.content, ROUTER_PROMPT);
    assert.equal(sent[1]?.role, "user");
    assert.equal(sent[1]?.content, "status do checkout");
    const routeEvents = result.trace.filter((event) => event.type === "route");
    assert.equal(routeEvents.length, 1);
    assert.deepEqual(routeEvents[0], {
      type: "route",
      route: "react",
      reason: "consulta curta",
      override: false,
      node: "roteador",
    });
    assert.ok(result.trace.every((event) => "node" in event && event.node));
    assert.equal(result.metrics.llmCalls, 1);
  });

  it("rejeita saída inválida do roteador sem rodar estratégia", async () => {
    const cases: Array<() => Promise<{ route: string; reason: string }>> = [
      async () => {
        throw new Error("modelo fora");
      },
      async () => ({ route: "", reason: "" }),
      async () => ({ route: "react", reason: "   " }),
      async () => ({ route: "custom", reason: "não existe" }),
    ];
    for (const verdict of cases) {
      const react = fakeStrategy("react");
      const planExecute = fakeStrategy("planExecute");
      const reflect = fakeStrategy("reflect");
      await assert.rejects(
        () =>
          runProductionGraph(baseInput(), {
            strategies: strategiesFor({ react, planExecute, reflect }),
            routeModel: routeModel(verdict),
          }),
        ModelOutputError,
      );
      assert.equal(react.runs + planExecute.runs + reflect.runs, 0);
    }
  });

  it("coloca summarize no nó context antes do route", async () => {
    const result = await runProductionGraph(
      baseInput({ summarizeContent: "plantão anterior" }),
      {
        strategies: strategiesFor({
          react: fakeStrategy("react"),
          planExecute: fakeStrategy("planExecute"),
          reflect: fakeStrategy("reflect"),
        }),
        routeModel: routeModel({ route: "react", reason: "consulta curta" }),
      },
    );
    assert.equal(result.trace[0]?.type, "summarize");
    assert.equal(result.trace[0]?.node, "context");
    assert.equal(result.trace[1]?.type, "route");
  });

  it("carimba node da base e do crítico", async () => {
    const events: TraceEvent[] = [
      { type: "thought", content: "olhar alertas" },
      { type: "critique", content: "[APROVADO] ok" },
      { type: "answer", content: "feito" },
    ];
    const reactResult = await runProductionGraph(baseInput(), {
      strategies: strategiesFor({
        react: fakeStrategy("react", events),
        planExecute: fakeStrategy("planExecute", events),
        reflect: fakeStrategy("reflect", events),
      }),
      routeModel: routeModel({ route: "react", reason: "consulta curta" }),
    });
    const reactNodes = reactResult.trace
      .filter((event) => event.type !== "route")
      .map((event) => event.node);
    assert.deepEqual(reactNodes, ["react", "reflect", "react"]);

    const reflectResult = await runProductionGraph(baseInput(), {
      strategies: strategiesFor({
        react: fakeStrategy("react", events),
        planExecute: fakeStrategy("planExecute", events),
        reflect: fakeStrategy("reflect", events),
      }),
      routeModel: routeModel({ route: "reflect", reason: "precisa revisar" }),
    });
    const reflectNodes = reflectResult.trace
      .filter((event) => event.type !== "route")
      .map((event) => event.node);
    assert.deepEqual(reflectNodes, ["react", "reflect", "react"]);
  });

  it("override não chama o roteador", async () => {
    const planExecute = fakeStrategy("planExecute");
    const router = routeModel(async () => {
      throw new Error("não devia");
    });
    const result = await runProductionGraph(
      baseInput({ strategy: "planExecute" }),
      {
        strategies: strategiesFor({
          react: fakeStrategy("react"),
          planExecute,
          reflect: fakeStrategy("reflect"),
        }),
        routeModel: router,
      },
    );
    assert.equal(router.calls, 0);
    assert.equal(planExecute.runs, 1);
    assert.equal(result.metrics.llmCalls, 0);
    assert.deepEqual(result.trace[0], {
      type: "route",
      route: "planExecute",
      reason: OVERRIDE_REASON,
      override: true,
      node: "roteador",
    });
  });

  it("reflect true restringe o roteador e envolve a base", async () => {
    const react = fakeStrategy("react", [
      { type: "thought", content: "passo" },
      { type: "answer", content: "pronto" },
    ]);
    await assert.rejects(
      () =>
        runProductionGraph(baseInput({ reflect: true }), {
          strategies: strategiesFor({
            react,
            planExecute: fakeStrategy("planExecute"),
            reflect: fakeStrategy("reflect"),
          }),
          routeModel: routeModel({ route: "reflect", reason: "revisar" }),
        }),
      ModelOutputError,
    );

    const router = routeModel(async () => {
      throw new Error("override");
    });
    const critic = {
      withStructuredOutput() {
        return {
          async invoke() {
            return { approved: true, feedback: "ok" };
          },
        };
      },
    };
    const wrapped = await runProductionGraph(
      baseInput({ strategy: "react", reflect: true }),
      {
        strategies: strategiesFor({
          react,
          planExecute: fakeStrategy("planExecute"),
          reflect: fakeStrategy("reflect"),
        }),
        routeModel: router,
        critic: { model: critic as never },
      },
    );
    assert.equal(router.calls, 0);
    const routeEvent = wrapped.trace.find((event) => event.type === "route");
    assert.ok(routeEvent && routeEvent.type === "route");
    assert.equal(routeEvent.route, "react");
    assert.equal(routeEvent.override, true);
    const critique = wrapped.trace.find((event) => event.type === "critique");
    assert.equal(critique?.node, "reflect");
  });

  it("rota team não embrulha reflexão e conserva o nó do handoff", async () => {
    const team = fakeStrategy("team", [
      { type: "handoff", from: "supervisor", to: "done", brief: "ok", node: "supervisor" },
      { type: "answer", content: "ok", node: "supervisor" },
    ]);
    await assert.rejects(
      () =>
        runProductionGraph(baseInput({ reflect: true }), {
          strategies: strategiesFor({
            react: fakeStrategy("react"),
            planExecute: fakeStrategy("planExecute"),
            reflect: fakeStrategy("reflect"),
            team,
          }),
          routeModel: routeModel({ route: "team", reason: "equipe" }),
        }),
      ModelOutputError,
    );

    const router = routeModel(async () => {
      throw new Error("não devia");
    });
    const result = await runProductionGraph(baseInput({ strategy: "team", reflect: true }), {
      strategies: strategiesFor({
        react: fakeStrategy("react"),
        planExecute: fakeStrategy("planExecute"),
        reflect: fakeStrategy("reflect"),
        team,
      }),
      routeModel: router,
    });
    assert.equal(router.calls, 0);
    assert.equal(team.runs, 1);
    assert.equal(result.visited[2], "team");
    assert.equal(result.trace.some((event) => event.type === "critique"), false);
    const handoff = result.trace.find((event) => event.type === "handoff");
    assert.equal(handoff?.node, "supervisor");
  });

  it("repropaga ModelUnavailableError do roteador sem nova chamada", async () => {
    let calls = 0;
    await assert.rejects(
      () => runProductionGraph(baseInput(), {
        routeModel: {
          async invoke() {
            calls += 1;
            throw new ModelUnavailableError();
          },
        },
        strategies: strategiesFor({
          react: fakeStrategy("react"),
          planExecute: fakeStrategy("planExecute"),
          reflect: fakeStrategy("reflect"),
        }),
      }),
      (error: unknown) => error instanceof ModelUnavailableError,
    );
    assert.equal(calls, 1);
  });
});
