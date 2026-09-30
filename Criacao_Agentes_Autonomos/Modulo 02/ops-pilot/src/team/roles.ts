/**
 * Uma rodada por papel. O planejador não recebe bindTools.
 * O executor só invoca ferramentas da lista já filtrada.
 */
import { z } from "zod";
import { ModelOutputError } from "../errors.js";
import { createModel } from "../agents/model.js";
import { createLlmCallCounter } from "../agents/metrics.js";
import type { TraceEvent } from "../agents/types.js";
import type { IncidentAction } from "./blackboard.js";
import type { NamedTool } from "./allowlist.js";

export const ANALYST_PROMPT = `Você é o analista do plantão. Sua única função: produzir diagnóstico FACTUAL do estado atual, com as ferramentas de leitura. Liste: alertas disparando (com data e severidade), incidentes recentes (abertos e resolvidos), runbooks relevantes, status dos provedores, janelas e fatos conhecidos. NÃO proponha soluções. NÃO abra nem resolva nada.
Formato: tópicos telegráficos. Seja cético: se um dado não está nas observações, não afirme.`;

export const PLANNER_PROMPT = `Você é o planejador do plantão. Sem ferramentas. Escreva só o plano, em passos curtos. Não abra nem resolva incidente.`;

export const EXECUTOR_PROMPT = `Você é o executor do plantão. Execute somente o recado do supervisor usando open_incident ou resolve_incident. Não consulte alertas, não leia runbook e não grave incidente por outro caminho.`;

const planSchema = z.object({
  plan: z.string().describe("plano em linhas curtas, sem executar ferramentas"),
});

export interface RoleContext {
  message: string;
  brief: string;
  blackboardText: string;
  tools: readonly NamedTool[];
}

export interface RoleTurn {
  findings?: string;
  plan?: string;
  actions?: IncidentAction[];
  trace: TraceEvent[];
  llmCalls?: number;
  promptTokens?: number;
}

type ToolCall = { name: string; args?: unknown };

type ToolCaller = {
  invoke(
    messages: unknown,
    options?: { callbacks?: unknown[] },
  ): Promise<{ content?: unknown; tool_calls?: ToolCall[] }>;
};

export type ToolRoleModel = {
  bindTools(tools: readonly NamedTool[]): ToolCaller;
  invoke: ToolCaller["invoke"];
};

export type PlannerModel = {
  withStructuredOutput(schema: unknown): {
    invoke(
      messages: unknown,
      options?: { callbacks?: unknown[] },
    ): Promise<{ plan?: string }>;
  };
};

function textOf(content: unknown): string {
  return typeof content === "string" ? content.trim() : "";
}

function asToolModel(): ToolRoleModel {
  const model = createModel();
  return {
    bindTools(tools) {
      const bound = model.bindTools(tools as never);
      return {
        invoke: (messages, options) => bound.invoke(messages as never, options as never),
      };
    },
    invoke: (messages, options) => model.invoke(messages as never, options as never),
  };
}

function asPlannerModel(): PlannerModel {
  const model = createModel();
  return {
    withStructuredOutput(schema) {
      const structured = model.withStructuredOutput(schema as never);
      return {
        invoke: (messages, options) => structured.invoke(messages as never, options as never),
      };
    },
  };
}

async function runCalls(
  calls: readonly ToolCall[],
  tools: readonly NamedTool[],
  node: "analista" | "executor",
): Promise<{ trace: TraceEvent[]; actions: IncidentAction[] }> {
  const trace: TraceEvent[] = [];
  const actions: IncidentAction[] = [];
  for (const call of calls) {
    const tool = tools.find((item) => item.name === call.name);
    if (!tool) {
      throw new ModelOutputError(
        `O modelo não retornou saída estruturada válida em "${node}".`,
      );
    }
    const args = call.args ?? {};
    trace.push({ type: "action", tool: call.name, args, node });
    const raw = await tool.invoke(args);
    const observation = typeof raw === "string" ? raw : JSON.stringify(raw);
    trace.push({ type: "observation", content: observation, node });
    if (node === "executor" && (call.name === "open_incident" || call.name === "resolve_incident")) {
      actions.push({ tool: call.name, args, observation });
    }
  }
  return { trace, actions };
}

export async function runAnalyst(ctx: RoleContext, model?: ToolRoleModel): Promise<RoleTurn> {
  const llm = model ?? asToolModel();
  const counter = createLlmCallCounter();
  const callbacks = { callbacks: [counter.handler] };
  const first = await llm.bindTools(ctx.tools).invoke(
    [
      ["system", ANALYST_PROMPT],
      ["user", `Recado: ${ctx.brief}\n${ctx.blackboardText}`],
    ],
    callbacks,
  );
  const calls = first.tool_calls ?? [];
  if (calls.length === 0) {
    return {
      findings: textOf(first.content),
      trace: [{ type: "thought", content: textOf(first.content), node: "analista" }],
      llmCalls: counter.calls,
      promptTokens: counter.promptTokens,
    };
  }
  const executed = await runCalls(calls, ctx.tools, "analista");
  const second = await llm.invoke(
    [
      ["system", ANALYST_PROMPT],
      ["user", `Recado: ${ctx.brief}\nObservações:\n${executed.trace
        .filter((event) => event.type === "observation")
        .map((event) => event.content)
        .join("\n")}`],
    ],
    callbacks,
  );
  const findings = textOf(second.content);
  return {
    findings,
    trace: [
      ...executed.trace,
      { type: "thought", content: findings, node: "analista" },
    ],
    llmCalls: counter.calls,
    promptTokens: counter.promptTokens,
  };
}

export async function runPlanner(ctx: RoleContext, model?: PlannerModel): Promise<RoleTurn> {
  const llm = model ?? asPlannerModel();
  const counter = createLlmCallCounter();
  const output = await llm.withStructuredOutput(planSchema).invoke(
    [
      ["system", PLANNER_PROMPT],
      ["user", `Recado: ${ctx.brief}\n${ctx.blackboardText}`],
    ],
    { callbacks: [counter.handler] },
  );
  const plan = output.plan?.trim() ?? "";
  if (plan.length === 0) {
    throw new ModelOutputError(
      `O modelo não retornou saída estruturada válida em "planejador".`,
    );
  }
  const steps = plan.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  return {
    plan,
    trace: [{ type: "plan", steps, node: "planejador" }],
    llmCalls: counter.calls,
    promptTokens: counter.promptTokens,
  };
}

export async function runExecutor(ctx: RoleContext, model?: ToolRoleModel): Promise<RoleTurn> {
  const llm = model ?? asToolModel();
  const counter = createLlmCallCounter();
  const first = await llm.bindTools(ctx.tools).invoke(
    [
      ["system", EXECUTOR_PROMPT],
      ["user", `Recado: ${ctx.brief}\n${ctx.blackboardText}`],
    ],
    { callbacks: [counter.handler] },
  );
  const executed = await runCalls(first.tool_calls ?? [], ctx.tools, "executor");
  return {
    actions: executed.actions,
    trace: executed.trace,
    llmCalls: counter.calls,
    promptTokens: counter.promptTokens,
  };
}
