/**
 * Grafo único de produção do chat:
 * context → roteador → react | planExecute | reflect | team → resposta.
 */
import { END, ReducedValue, START, StateGraph, StateSchema } from "@langchain/langgraph";
import { z } from "zod";
import { ModelOutputError, ModelUnavailableError } from "../errors.js";
import { planAndExecuteStrategy } from "../agents/plan-and-execute.js";
import { reactStrategy } from "../agents/react.js";
import { withReflection, type CriticDependencies } from "../agents/reflection.js";
import { createModel } from "../agents/model.js";
import { createLlmCallCounter } from "../agents/metrics.js";
import type {
  ChatHistoryMessage,
  ReasoningStrategy,
  StrategyResult,
  TraceEvent,
} from "../agents/types.js";
import {
  buildContext,
  type SectionBudgets,
} from "../context/context-builder.js";
import type { ContextBreakdown } from "../context/tokens.js";
import { teamStrategy } from "../team/team-graph.js";

export const PRODUCTION_ROUTES = ["react", "planExecute", "reflect", "team"] as const;
export type ProductionRoute = (typeof PRODUCTION_ROUTES)[number];

export const OVERRIDE_REASON = "estratégia informada pelo cliente";

export const SYSTEM_PROMPT = `Você é o roteador do OpsPilot, copilot de plantão.
Escolha exatamente uma rota para o pedido do plantonista.

| route | quando usar |
|-------|-------------|
| react | consulta ou ação operacional resolvível com ferramentas em poucas iterações |
| planExecute | pedido com vários passos dependentes que precisa de um plano explícito |
| reflect | pedido em que a resposta precisa de revisão crítica antes de ser entregue |
| team | o pedido precisa ler a situação, propor um plano e agir em incidente, com papéis separados |`;

export const ROUTER_PROMPT = SYSTEM_PROMPT;

export const routeSchema = z.object({
  route: z.enum(PRODUCTION_ROUTES),
  reason: z.string().describe("uma frase justificando a escolha do roteador"),
});

const BASE_ROUTES = ["react", "planExecute"] as const;
type StrategyBase = (typeof BASE_ROUTES)[number];

export function stampTraceNode(
  events: readonly TraceEvent[],
  base: StrategyBase,
): TraceEvent[] {
  return events.map((event) => {
    if (event.type === "route" || event.type === "handoff") {
      return event;
    }
    const node = event.type === "critique" ? "reflect" : base;
    return { ...event, node };
  });
}

export interface RouteModel {
  invoke(
    messages: readonly { role: string; content: string }[],
  ): Promise<{ route: string; reason: string; promptTokens?: number }>;
}

export interface ProductionGraphInput {
  message: string;
  history: readonly ChatHistoryMessage[];
  memories: readonly { fact: string; score: number }[];
  summary?: string;
  summarizeContent?: string;
  budgets: SectionBudgets;
  strategy?: ProductionRoute;
  reflect?: boolean;
  tools?: readonly unknown[];
}

export interface ProductionGraphDeps {
  strategies?: Record<ProductionRoute, ReasoningStrategy>;
  routeModel?: RouteModel;
  critic?: CriticDependencies;
}

export interface ProductionGraphResult extends StrategyResult {
  visited: readonly string[];
}

const GraphState = new StateSchema({
  input: z.string(),
  route: z.enum(PRODUCTION_ROUTES).default("react"),
  answer: z.string().default(""),
  llmCalls: z.number().default(0),
  promptTokens: z.number().default(0),
  historyMessages: z.number().default(0),
  recalledMemories: z.number().default(0),
  trace: new ReducedValue(z.array(z.unknown()).default(() => []), {
    inputSchema: z.array(z.unknown()),
    reducer: (current, next) => [...current, ...next],
  }),
  visited: new ReducedValue(z.array(z.string()).default(() => []), {
    inputSchema: z.array(z.string()),
    reducer: (current, next) => [...current, ...next],
  }),
});

type GraphStateType = typeof GraphState.State;

function defaultStrategies(): Record<ProductionRoute, ReasoningStrategy> {
  return {
    react: reactStrategy,
    planExecute: planAndExecuteStrategy,
    reflect: withReflection(reactStrategy),
    team: teamStrategy,
  };
}

function isProductionRoute(value: string): value is ProductionRoute {
  return (PRODUCTION_ROUTES as readonly string[]).includes(value);
}

function allowedRoutes(reflect: boolean): readonly ProductionRoute[] {
  return reflect ? BASE_ROUTES : PRODUCTION_ROUTES;
}

async function invokeDefaultRouteModel(
  messages: readonly { role: string; content: string }[],
): Promise<{ route: string; reason: string; promptTokens: number }> {
  const counter = createLlmCallCounter();
  const structured = createModel().withStructuredOutput(routeSchema, {
    method: "functionCalling",
  });
  let lastError: unknown;
  for (let attempt = 0; attempt <= 1; attempt += 1) {
    try {
      const verdict = await structured.invoke([...messages], {
        callbacks: [counter.handler],
      });
      if (verdict && typeof verdict.route === "string") {
        return {
          route: verdict.route,
          reason: typeof verdict.reason === "string" ? verdict.reason : "",
          promptTokens: counter.promptTokens,
        };
      }
      lastError = undefined;
    } catch (error) {
      if (error instanceof ModelUnavailableError) {
        throw error;
      }
      lastError = error;
    }
  }
  throw new ModelOutputError(
    `O modelo não retornou saída estruturada válida em "roteador".` +
      (lastError instanceof Error ? ` Causa: ${lastError.message}` : ""),
  );
}

function acceptVerdict(
  raw: { route?: string; reason?: string },
  allowed: readonly ProductionRoute[],
): { route: ProductionRoute; reason: string } {
  const reason = raw.reason?.trim() ?? "";
  if (!raw.route || !isProductionRoute(raw.route) || !allowed.includes(raw.route) || reason.length === 0) {
    throw new ModelOutputError(
      `O modelo não retornou saída estruturada válida em "roteador".`,
    );
  }
  return { route: raw.route, reason };
}

export async function runProductionGraph(
  input: ProductionGraphInput,
  deps: ProductionGraphDeps = {},
): Promise<ProductionGraphResult> {
  const started = performance.now();
  const strategies = deps.strategies ?? defaultStrategies();
  const reflect = input.reflect ?? false;
  let routerCalls = 0;
  let routerPromptTokens = 0;
  let breakdown: ContextBreakdown = {
    message: 0,
    history: 0,
    memories: 0,
    summary: 0,
  };
  let budgeted = buildContext(
    {
      message: input.message,
      summary: input.summary,
      history: input.history,
      memories: input.memories,
    },
    input.budgets,
  );

  async function contextNode(state: GraphStateType) {
    budgeted = buildContext(
      {
        message: input.message,
        summary: input.summary,
        history: input.history,
        memories: input.memories,
      },
      input.budgets,
    );
    breakdown = budgeted.breakdown;
    const trace: TraceEvent[] = [];
    if (input.summarizeContent !== undefined) {
      trace.push({
        type: "summarize",
        content: input.summarizeContent,
        node: "context",
      });
    }
    return {
      input: budgeted.message,
      trace,
      visited: ["context"],
      historyMessages: budgeted.history.length,
      recalledMemories: budgeted.memories.length,
    };
  }

  async function routerNode(state: GraphStateType) {
    if (input.strategy) {
      if (!isProductionRoute(input.strategy)) {
        throw new ModelOutputError(
          `O modelo não retornou saída estruturada válida em "roteador".`,
        );
      }
      const decision = acceptVerdict(
        { route: input.strategy, reason: OVERRIDE_REASON },
        [input.strategy],
      );
      const event: TraceEvent = {
        type: "route",
        route: decision.route,
        reason: decision.reason,
        override: true,
        node: "roteador",
      };
      return { route: decision.route, trace: [event], visited: ["roteador"] };
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: state.input },
    ];
    let raw: { route?: string; reason?: string; promptTokens?: number };
    try {
      raw = deps.routeModel
        ? await deps.routeModel.invoke(messages)
        : await invokeDefaultRouteModel(messages);
    } catch (error) {
      if (error instanceof ModelOutputError || error instanceof ModelUnavailableError) {
        throw error;
      }
      throw new ModelOutputError(
        `O modelo não retornou saída estruturada válida em "roteador".` +
          (error instanceof Error ? ` Causa: ${error.message}` : ""),
      );
    }
    routerCalls = 1;
    routerPromptTokens = raw.promptTokens ?? 0;
    const decision = acceptVerdict(raw, allowedRoutes(reflect));
    const event: TraceEvent = {
      type: "route",
      route: decision.route,
      reason: decision.reason,
      override: false,
      node: "roteador",
    };
    return { route: decision.route, trace: [event], visited: ["roteador"] };
  }

  function strategyNode(route: ProductionRoute) {
    return async function runStrategy(): Promise<Partial<GraphStateType>> {
      let strategy = strategies[route];
      if (reflect && route !== "reflect" && route !== "team") {
        strategy = withReflection(strategy, undefined, deps.critic);
      }
      const result = await strategy.run(
        {
          message: budgeted.message,
          history: budgeted.history,
          memories: budgeted.memories,
          summary: budgeted.summary,
        },
        input.tools ? { tools: input.tools } : undefined,
      );
      const trace =
        route === "team"
          ? result.trace.map((event) => {
              if (event.type === "route" || event.node) {
                return event;
              }
              return { ...event, node: "team" };
            })
          : stampTraceNode(result.trace, route === "reflect" ? "react" : route);
      return {
        answer: result.answer,
        llmCalls: result.metrics.llmCalls,
        promptTokens: result.metrics.promptTokens ?? 0,
        trace,
        visited: [route],
      };
    };
  }

  function respostaNode(state: GraphStateType) {
    return {
      llmCalls: state.llmCalls + routerCalls,
      promptTokens: state.promptTokens + routerPromptTokens,
      visited: ["resposta"],
    };
  }

  const graph = new StateGraph(GraphState)
    .addNode("context", contextNode)
    .addNode("roteador", routerNode)
    .addNode("react", strategyNode("react"))
    .addNode("planExecute", strategyNode("planExecute"))
    .addNode("reflect", strategyNode("reflect"))
    .addNode("team", strategyNode("team"))
    .addNode("resposta", respostaNode)
    .addEdge(START, "context")
    .addEdge("context", "roteador")
    .addConditionalEdges("roteador", (state) => state.route, {
      react: "react",
      planExecute: "planExecute",
      reflect: "reflect",
      team: "team",
    })
    .addEdge("react", "resposta")
    .addEdge("planExecute", "resposta")
    .addEdge("reflect", "resposta")
    .addEdge("team", "resposta")
    .addEdge("resposta", END);

  const final = await graph.compile().invoke({
    input: input.message,
    trace: [],
    visited: [],
  });

  const trace = final.trace as TraceEvent[];
  return {
    answer: final.answer,
    trace,
    visited: final.visited as string[],
    metrics: {
      llmCalls: final.llmCalls,
      latencyMs: Math.round(performance.now() - started),
      promptTokens: final.promptTokens,
      historyMessages: final.historyMessages,
      recalledMemories: final.recalledMemories,
      contextBreakdown: breakdown,
    },
  };
}
