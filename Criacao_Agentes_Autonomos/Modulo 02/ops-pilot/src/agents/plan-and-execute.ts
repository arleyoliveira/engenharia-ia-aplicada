/**
 * Estratégia Plan-and-Execute como grafo (research R2).
 * planner (saída estruturada, máx. 8 passos) → executor (um passo por vez
 * com tools) → replanner (união discriminada respond/continue).
 */
import { StateGraph, START, END, StateSchema, ReducedValue } from "@langchain/langgraph";
import type { Runnable } from "@langchain/core/runnables";
import type { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { z } from "zod";
import type {
  ReasoningStrategy,
  StrategyResult,
  StrategyRunOptions,
  TraceEvent,
} from "./types.js";
import { createModel } from "./model.js";
import { createDefaultOpsTools } from "./tools.js";
import { createLlmCallCounter } from "./metrics.js";
import { ModelOutputError } from "../errors.js";

const STRUCTURED_OUTPUT_RETRIES = 1;

/**
 * Alguns modelos gratuitos do OpenRouter ocasionalmente não emitem a tool call
 * esperada (saída indefinida). Tenta novamente antes de reportar erro claro.
 */
async function invokeStructured<T>(
  runnable: Runnable<unknown, T>,
  messages: { role: string; content: string }[],
  callbacks: BaseCallbackHandler[],
  step: string,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= STRUCTURED_OUTPUT_RETRIES; attempt += 1) {
    try {
      const result = await runnable.invoke(messages, { callbacks });
      if (result !== undefined) {
        return result;
      }
      lastError = undefined;
    } catch (error) {
      lastError = error;
    }
  }
  throw new ModelOutputError(
    `O modelo não retornou saída estruturada válida em "${step}".` +
      (lastError instanceof Error ? ` Causa: ${lastError.message}` : ""),
  );
}

const MAX_STEPS = 8;
const DEFAULT_MAX_ITERATIONS = 8;

const planSchema = z.object({
  steps: z
    .array(z.string().min(1))
    .min(1)
    .max(MAX_STEPS)
    .describe("Passos simples, um por vez, que juntos resolvem o input."),
});

const replanSchema = z.object({
  action: z.enum(["respond", "continue"]),
  response: z
    .string()
    .optional()
    .describe("Resposta final ao usuário (quando action=respond)."),
  steps: z
    .array(z.string().min(1))
    .max(MAX_STEPS)
    .optional()
    .describe("Passos restantes revisados (quando action=continue)."),
});

const PlanState = new StateSchema({
  input: z.string(),
  plan: z.array(z.string()).default([]),
  // ReducedValue: cada nó retorna apenas o incremento; o reducer concatena ao histórico.
  pastSteps: new ReducedValue(
    z.array(z.tuple([z.string(), z.string()])).default(() => []),
    {
      inputSchema: z.array(z.tuple([z.string(), z.string()])),
      reducer: (current, next) => [...current, ...next],
    },
  ),
  response: z.string().default(""),
  trace: new ReducedValue(z.array(z.unknown()).default(() => []), {
    inputSchema: z.array(z.unknown()),
    reducer: (current, next) => [...current, ...next],
  }),
  iterations: z.number().default(0),
  maxIterations: z.number().default(DEFAULT_MAX_ITERATIONS),
});

type PlanStateType = typeof PlanState.State;

const PLANNER_PROMPT = `Você é o planejador do OpsPilot, copilot de plantão.
Para o objetivo abaixo, elabore um plano simples de passos curtos (máximo ${MAX_STEPS}).
Cada passo deve ser executável por um agente com ferramentas: list_alerts, open_incident, resolve_incident.
O último passo deve produzir a resposta final ao plantonista.`;

const EXECUTOR_PROMPT = `Você é o executor do OpsPilot. Execute APENAS o passo atual usando as ferramentas disponíveis.
Responda com o resultado objetivo do passo.`;

const REPLANNER_PROMPT = `Você é o replanejador do OpsPilot.
Objetivo original, plano restante e passos já executados são dados.
- Se o objetivo estiver cumprido (ou todos os passos executados), responda action=respond com a resposta final.
- Caso contrário, responda action=continue com os passos restantes revisados (máximo ${MAX_STEPS}).`;

export function createPlanAndExecuteStrategy(config?: {
  tools?: readonly unknown[];
  noReplanner?: boolean;
}): ReasoningStrategy {
  const strategyName = config?.noReplanner
    ? "plan-and-execute (no-replanner)"
    : "plan-and-execute";

  return {
    name: strategyName,
    async run(
      input: string,
      options?: StrategyRunOptions,
    ): Promise<StrategyResult> {
      const started = performance.now();
      const counter = createLlmCallCounter();
      const model = createModel();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opsTools = (options?.tools ?? config?.tools ?? (await createDefaultOpsTools())) as any[];
      const tools = [...opsTools];
      const maxIterations =
        options?.maxIterations ?? DEFAULT_MAX_ITERATIONS;
      const noReplanner = options?.noReplanner ?? config?.noReplanner ?? false;

      // functionCalling é mais compatível entre provedores OpenRouter do que o
      // método jsonSchema (default para modelos não-OpenAI), que retorna vazio
      // em modelos sem suporte a response_format estrito.
      const planner = model.withStructuredOutput(planSchema, {
        method: "functionCalling",
      });
      const replanner = model.withStructuredOutput(replanSchema, {
        method: "functionCalling",
      });
      const executorModel = model.bindTools(tools);

      const callbacks = [counter.handler];

      async function plannerNode(state: PlanStateType) {
        const plan = await invokeStructured(
          planner,
          [
            { role: "system", content: PLANNER_PROMPT },
            { role: "user", content: state.input },
          ],
          callbacks,
          "planner",
        );
        const steps = plan.steps.slice(0, MAX_STEPS);
        return {
          plan: steps,
          trace: [{ type: "plan", steps } satisfies TraceEvent],
          iterations: 0,
        };
      }

      async function executorNode(state: PlanStateType) {
        const step = state.plan[0];
        if (!step) {
          return { response: state.pastSteps.at(-1)?.[1] ?? "Plano concluído." };
        }
        const past = state.pastSteps
          .map(([s, r]) => `- ${s}: ${r}`)
          .join("\n");
        const result = await executorModel.invoke(
          [
            { role: "system", content: EXECUTOR_PROMPT },
            {
              role: "user",
              content: `Objetivo: ${state.input}\nPassos concluídos:\n${past || "(nenhum)"}\nPasso atual: ${step}`,
            },
          ],
          { callbacks },
        );

        const events: TraceEvent[] = [];
        let stepResult =
          typeof result.content === "string" ? result.content : "";
        for (const call of result.tool_calls ?? []) {
          events.push({ type: "action", tool: call.name, args: call.args });
        }

        // Executa as ferramentas pedidas (uma passada por passo).
        let observation = "";
        for (const call of result.tool_calls ?? []) {
          const toolImpl = tools.find((t) => t.name === call.name);
          if (toolImpl) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            observation = String(await (toolImpl as any).invoke(call.args));
            events.push({ type: "observation", content: observation });
          }
        }
        if (stepResult.trim() === "") {
          stepResult = observation || "(sem resultado)";
        }

        const remainingPlan = state.plan.slice(1);
        const iterations = state.iterations + 1;
        const isFinished = noReplanner && (remainingPlan.length === 0 || iterations >= state.maxIterations);

        return {
          plan: remainingPlan,
          pastSteps: [[step, stepResult] as [string, string]],
          response: isFinished ? stepResult : "",
          trace: events,
          iterations,
        };
      }

      async function replannerNode(state: PlanStateType) {
        const past = state.pastSteps
          .map(([s, r]) => `- ${s}: ${r}`)
          .join("\n");
        const output = await invokeStructured(
          replanner,
          [
            { role: "system", content: REPLANNER_PROMPT },
            {
              role: "user",
              content: `Objetivo: ${state.input}\nPlano restante: ${JSON.stringify(state.plan)}\nPassos concluídos:\n${past || "(nenhum)"}`,
            },
          ],
          callbacks,
          "replanner",
        );

        if (
          output.action === "respond" ||
          state.plan.length === 0 ||
          state.iterations >= state.maxIterations
        ) {
          const response =
            output.response ??
            state.pastSteps.at(-1)?.[1] ??
            "Objetivo concluído.";
          return {
            response,
            trace: [
              {
                type: "critique",
                content:
                  state.iterations >= state.maxIterations
                    ? `Limite de iterações (${state.maxIterations}) atingido.`
                    : "Replanner encerrou: objetivo cumprido ou sem passos restantes.",
              } satisfies TraceEvent,
            ],
          };
        }

        const steps = (output.steps ?? state.plan).slice(0, MAX_STEPS);
        return {
          plan: steps,
          trace: [{ type: "plan", steps } satisfies TraceEvent],
        };
      }

      function shouldContinue(state: PlanStateType): "executor" | typeof END {
        if (state.response !== "" || state.iterations >= state.maxIterations) {
          return END;
        }
        return "executor";
      }

      function shouldContinueNoReplanner(state: PlanStateType): "executor" | typeof END {
        if (
          state.response !== "" ||
          state.plan.length === 0 ||
          state.iterations >= state.maxIterations
        ) {
          return END;
        }
        return "executor";
      }

      const graphBuilder = new StateGraph(PlanState);
      if (noReplanner) {
        graphBuilder
          .addNode("planner", plannerNode)
          .addNode("executor", executorNode)
          .addEdge(START, "planner")
          .addEdge("planner", "executor")
          .addConditionalEdges("executor", shouldContinueNoReplanner, [
            "executor",
            END,
          ]);
      } else {
        graphBuilder
          .addNode("planner", plannerNode)
          .addNode("executor", executorNode)
          .addNode("replanner", replannerNode)
          .addEdge(START, "planner")
          .addEdge("planner", "executor")
          .addEdge("executor", "replanner")
          .addConditionalEdges("replanner", shouldContinue, ["executor", END]);
      }

      const graph = graphBuilder.compile();

      const final = await graph.invoke({
        input,
        plan: [],
        pastSteps: [],
        response: "",
        trace: [],
        iterations: 0,
        maxIterations,
      });

      const trace = (final.trace as TraceEvent[]).concat();
      const answer =
        final.response !== ""
          ? final.response
          : `Execução interrompida: limite de iterações (${maxIterations}) atingido.`;
      trace.push({ type: "answer", content: answer });

      return {
        answer,
        trace,
        metrics: {
          llmCalls: counter.calls,
          latencyMs: Math.round(performance.now() - started),
        },
      };
    },
  };
}

export const planAndExecuteStrategy: ReasoningStrategy =
  createPlanAndExecuteStrategy();
