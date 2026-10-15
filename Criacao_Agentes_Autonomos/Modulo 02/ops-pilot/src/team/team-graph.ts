/**
 * Modo equipe: supervisor escolhe o próximo nó com saída estruturada
 * sobre o quadro do turno. Aresta condicional: state.next.
 */
import { END, ReducedValue, START, StateGraph, StateSchema } from "@langchain/langgraph";
import { z } from "zod";
import { ModelOutputError, ModelUnavailableError } from "../errors.js";
import { createModel } from "../agents/model.js";
import { createLlmCallCounter } from "../agents/metrics.js";
import { createDefaultOpsTools } from "../agents/tools.js";
import type {
  ReasoningStrategy,
  StrategyInput,
  StrategyResult,
  StrategyRunOptions,
  TraceEvent,
} from "../agents/types.js";
import {
  appendAction,
  appendBrief,
  appendFindings,
  blackboardAsText,
  emptyBlackboard,
  replacePlan,
  TEAM_NEXT,
  type Blackboard,
  type TeamNext,
  type TeamRole,
} from "./blackboard.js";
import { toolsFor, type NamedTool } from "./allowlist.js";
import { runAnalyst, runExecutor, runPlanner, type RoleContext, type RoleTurn } from "./roles.js";

export const TEAM_HANDOFF_LIMIT = 8;

export const LIMIT_ANSWER = "Execução interrompida: limite de iterações (8) atingido.";

export const nextSchema = z.object({
  next: z.enum(["analista", "planejador", "executor", "done"]),
  brief: z
    .string()
    .describe("instrução de trabalho para o próximo papel (nó) ou resumo final se done"),
});

export const supervisorSchema = nextSchema;

export const SUPERVISOR_PROMPT = `Você é o supervisor do OpsPilot, copilot de plantão.
Escolha exatamente um próximo nó e escreva o recado.

| next | quando escolher |
|------|-----------------|
| analista | falta diagnóstico factual; só leitura, não propõe solução, não abre nem resolve |
| planejador | já há achados e falta plano; sem ferramentas |
| executor | já há plano que pede abrir ou resolver incidente; só open_incident e resolve_incident |
| done | o turno pode encerrar; o brief é o resumo final |`;

export type SupervisorModel = {
  invoke(
    messages: ReadonlyArray<readonly [string, string]>,
  ): Promise<{ next?: string; brief?: string; promptTokens?: number }>;
};

export type RoleRunner = (ctx: RoleContext) => Promise<RoleTurn>;

export interface TeamDeps {
  supervisor?: SupervisorModel;
  roles?: Partial<Record<TeamRole, RoleRunner>>;
}

type ActionState = { tool: string; argsJson: string; observation: string };
type BriefState = { next: TeamNext; brief: string };

const TeamState = new StateSchema({
  message: z.string(),
  findings: z.string().default(""),
  plan: z.string().default(""),
  actions: z
    .array(
      z.object({
        tool: z.string(),
        argsJson: z.string(),
        observation: z.string(),
      }),
    )
    .default(() => []),
  briefs: z
    .array(
      z.object({
        next: z.enum(TEAM_NEXT),
        brief: z.string(),
      }),
    )
    .default(() => []),
  next: z.enum(TEAM_NEXT).default("done"),
  brief: z.string().default(""),
  handoffs: z.number().default(0),
  answer: z.string().default(""),
  llmCalls: z.number().default(0),
  promptTokens: z.number().default(0),
  trace: new ReducedValue(z.array(z.unknown()).default(() => []), {
    inputSchema: z.array(z.unknown()),
    reducer: (current, next) => [...current, ...next],
  }),
});

type TeamStateType = typeof TeamState.State;

function boardFrom(state: TeamStateType): Blackboard {
  return {
    findings: state.findings,
    plan: state.plan,
    actions: state.actions.flatMap((action) => {
      if (action.tool !== "open_incident" && action.tool !== "resolve_incident") {
        return [];
      }
      let args: unknown = null;
      try {
        args = JSON.parse(action.argsJson) as unknown;
      } catch {
        args = null;
      }
      return [{ tool: action.tool, args, observation: action.observation }];
    }),
    briefs: state.briefs,
  };
}

function boardFields(board: Blackboard): {
  findings: string;
  plan: string;
  actions: ActionState[];
  briefs: BriefState[];
} {
  return {
    findings: board.findings,
    plan: board.plan,
    actions: board.actions.map((action) => ({
      tool: action.tool,
      argsJson: JSON.stringify(action.args ?? null),
      observation: action.observation,
    })),
    briefs: [...board.briefs],
  };
}

function acceptVerdict(raw: { next?: string; brief?: string }): { next: TeamNext; brief: string } {
  const brief = raw.brief?.trim() ?? "";
  const next = raw.next;
  if (
    (next !== "analista" && next !== "planejador" && next !== "executor" && next !== "done") ||
    brief.length === 0
  ) {
    throw new ModelOutputError(
      `O modelo não retornou saída estruturada válida em "supervisor".`,
    );
  }
  return { next, brief };
}

async function callSupervisor(
  messages: Array<[string, string]>,
  deps: TeamDeps,
): Promise<{ next: TeamNext; brief: string; llmCalls: number; promptTokens: number }> {
  if (deps.supervisor) {
    let raw: { next?: string; brief?: string; promptTokens?: number };
    try {
      raw = await deps.supervisor.invoke(messages);
    } catch (error) {
      if (error instanceof ModelOutputError || error instanceof ModelUnavailableError) {
        throw error;
      }
      throw new ModelOutputError(
        `O modelo não retornou saída estruturada válida em "supervisor".` +
          (error instanceof Error ? ` Causa: ${error.message}` : ""),
      );
    }
    const verdict = acceptVerdict(raw);
    return {
      ...verdict,
      llmCalls: 1,
      promptTokens: raw.promptTokens ?? 0,
    };
  }

  const counter = createLlmCallCounter();
  const structured = createModel().withStructuredOutput(nextSchema);
  let lastError: unknown;
  for (let attempt = 0; attempt <= 1; attempt += 1) {
    try {
      const verdict = await structured.invoke(messages, {
        callbacks: [counter.handler],
      });
      if (verdict && typeof verdict.next === "string") {
        const accepted = acceptVerdict(verdict);
        return {
          ...accepted,
          llmCalls: counter.calls,
          promptTokens: counter.promptTokens,
        };
      }
      lastError = undefined;
    } catch (error) {
      if (error instanceof ModelUnavailableError) {
        throw error;
      }
      if (error instanceof ModelOutputError) {
        throw error;
      }
      lastError = error;
    }
  }
  throw new ModelOutputError(
    `O modelo não retornou saída estruturada válida em "supervisor".` +
      (lastError instanceof Error ? ` Causa: ${lastError.message}` : ""),
  );
}

function defaultRunner(role: TeamRole): RoleRunner {
  if (role === "analista") {
    return (ctx) => runAnalyst(ctx);
  }
  if (role === "planejador") {
    return (ctx) => runPlanner(ctx);
  }
  return (ctx) => runExecutor(ctx);
}

export async function runTeamGraph(
  input: { message: string; tools: readonly NamedTool[] },
  deps: TeamDeps = {},
): Promise<StrategyResult & { blackboard: Blackboard }> {
  const started = performance.now();

  async function supervisorNode(state: TeamStateType) {
    const blackboard = boardFrom(state);
    const messages: Array<[string, string]> = [
      ["system", SUPERVISOR_PROMPT],
      ["user", blackboardAsText({ message: state.message, blackboard })],
    ];
    const verdict = await callSupervisor(messages, deps);
    const handoff: TraceEvent = {
      type: "handoff",
      from: "supervisor",
      to: verdict.next,
      brief: verdict.brief,
      node: "supervisor",
    };
    const nextBoard = appendBrief(blackboard, { next: verdict.next, brief: verdict.brief });
    return {
      ...boardFields(nextBoard),
      next: verdict.next,
      brief: verdict.brief,
      handoffs: state.handoffs + 1,
      llmCalls: state.llmCalls + verdict.llmCalls,
      promptTokens: state.promptTokens + verdict.promptTokens,
      trace: [handoff],
    };
  }

  function roleNode(role: TeamRole) {
    return async function runRole(state: TeamStateType) {
      const blackboard = boardFrom(state);
      const tools = toolsFor(role, input.tools);
      const runner = deps.roles?.[role] ?? defaultRunner(role);
      const turn = await runner({
        message: state.message,
        brief: state.brief,
        blackboardText: blackboardAsText({ message: state.message, blackboard }),
        tools,
      });
      let nextBoard = blackboard;
      if (role === "analista" && turn.findings) {
        nextBoard = appendFindings(nextBoard, turn.findings);
      }
      if (role === "planejador" && turn.plan) {
        nextBoard = replacePlan(nextBoard, turn.plan);
      }
      if (role === "executor") {
        for (const action of turn.actions ?? []) {
          nextBoard = appendAction(nextBoard, action);
        }
      }
      return {
        ...boardFields(nextBoard),
        llmCalls: state.llmCalls + (turn.llmCalls ?? 0),
        promptTokens: state.promptTokens + (turn.promptTokens ?? 0),
        trace: turn.trace,
      };
    };
  }

  function doneNode(state: TeamStateType) {
    const answer = state.brief.trim();
    return {
      answer,
      trace: [{ type: "answer", content: answer, node: "supervisor" } satisfies TraceEvent],
    };
  }

  function limiteNode() {
    return {
      answer: LIMIT_ANSWER,
      trace: [{ type: "answer", content: LIMIT_ANSWER, node: "supervisor" } satisfies TraceEvent],
    };
  }

  function afterRole(state: TeamStateType) {
    return state.handoffs >= TEAM_HANDOFF_LIMIT ? "limite" : "supervisor";
  }

  const graph = new StateGraph(TeamState)
    .addNode("supervisor", supervisorNode)
    .addNode("analista", roleNode("analista"))
    .addNode("planejador", roleNode("planejador"))
    .addNode("executor", roleNode("executor"))
    .addNode("done", doneNode)
    .addNode("limite", limiteNode)
    .addEdge(START, "supervisor")
    .addConditionalEdges("supervisor", (state) => state.next, {
      analista: "analista",
      planejador: "planejador",
      executor: "executor",
      done: "done",
    })
    .addConditionalEdges("analista", afterRole, { supervisor: "supervisor", limite: "limite" })
    .addConditionalEdges("planejador", afterRole, { supervisor: "supervisor", limite: "limite" })
    .addConditionalEdges("executor", afterRole, { supervisor: "supervisor", limite: "limite" })
    .addEdge("done", END)
    .addEdge("limite", END);

  const final = await graph.compile().invoke({
    message: input.message,
    findings: "",
    plan: "",
    actions: [],
    briefs: [],
    trace: [],
  });

  return {
    answer: final.answer,
    trace: final.trace as TraceEvent[],
    blackboard: boardFrom(final),
    metrics: {
      llmCalls: final.llmCalls,
      latencyMs: Math.round(performance.now() - started),
      promptTokens: final.promptTokens,
    },
  };
}

function messageOf(input: StrategyInput): string {
  return typeof input === "string" ? input : input.message;
}

export function createTeamStrategy(deps: TeamDeps = {}): ReasoningStrategy {
  return {
    name: "team",
    async run(input: StrategyInput, options?: StrategyRunOptions): Promise<StrategyResult> {
      const tools = (options?.tools ?? (await createDefaultOpsTools())) as NamedTool[];
      const result = await runTeamGraph({ message: messageOf(input), tools }, deps);
      return {
        answer: result.answer,
        trace: result.trace,
        metrics: result.metrics,
      };
    },
  };
}

export const teamStrategy = createTeamStrategy();
