/**
 * Estratégia ReAct: agente pré-construído do LangGraph (research R1).
 * Converte mensagens em TraceEvents e mede métricas (llmCalls via callback).
 */
import type { LanguageModelLike } from "@langchain/core/language_models/base";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import {
  AIMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type {
  ReasoningStrategy,
  StrategyInput,
  StrategyResult,
  StrategyRunOptions,
  TraceEvent,
} from "./types.js";
import { createModel, runCollectingFallbacks } from "./model.js";
import { ModelUnavailableError } from "../errors.js";
import { createDefaultOpsTools } from "./tools.js";
import { createLlmCallCounter } from "./metrics.js";
import { toAgentMessages } from "../services/compose-chat-prompt.js";

const DEFAULT_MAX_ITERATIONS = 8;

/** Mensagens LangChain → trace tipado (contracts/trace.md). */
export function toTrace(messages: readonly BaseMessage[]): TraceEvent[] {
  const trace: TraceEvent[] = [];
  for (const message of messages) {
    if (AIMessage.isInstance(message)) {
      const text =
        typeof message.content === "string" ? message.content.trim() : "";
      if (text.length > 0) {
        trace.push({ type: "thought", content: text });
      }
      for (const call of message.tool_calls ?? []) {
        trace.push({ type: "action", tool: call.name, args: call.args });
      }
    } else if (ToolMessage.isInstance(message)) {
      const content =
        typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content);
      trace.push({ type: "observation", content });
    }
  }
  return trace;
}

function lastText(messages: readonly BaseMessage[]): string {
  const last = messages.at(-1);
  if (!last) {
    return "";
  }
  return typeof last.content === "string"
    ? last.content
    : JSON.stringify(last.content);
}

export function createReactStrategy(config?: {
  tools?: readonly unknown[];
}): ReasoningStrategy {
  return {
    name: "react",
    async run(
      input: StrategyInput,
      options?: StrategyRunOptions,
    ): Promise<StrategyResult> {
      return runCollectingFallbacks(async () => {
      const started = performance.now();
      const counter = createLlmCallCounter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opsTools = (options?.tools ?? config?.tools ?? (await createDefaultOpsTools())) as any[];
      const agent = createReactAgent({
        llm: createModel() as unknown as LanguageModelLike,
        tools: [...opsTools],
      });

      const maxIterations =
        options?.maxIterations ?? DEFAULT_MAX_ITERATIONS;

      const trace: TraceEvent[] = [];
      let answer: string;
      try {
        const result = await agent.invoke(
          { messages: toAgentMessages(input) },
          {
            // guardrail: nada de loop infinito (research R7)
            recursionLimit: Math.max(2, maxIterations * 2),
            callbacks: [counter.handler],
          },
        );
        trace.push(...toTrace(result.messages));
        answer = lastText(result.messages);
      } catch (error) {
        if (error instanceof ModelUnavailableError) {
          throw error;
        }
        // Encerramento controlado ao atingir o limite de recursão (FR-010).
        const message =
          error instanceof Error ? error.message : String(error);
        trace.push({
          type: "critique",
          content: `Limite de iterações atingido (${maxIterations}). ${message}`,
        });
        answer = `Execução interrompida: limite de iterações (${maxIterations}) atingido.`;
      }
      trace.push({ type: "answer", content: answer });

      return {
        answer,
        trace,
        metrics: {
          llmCalls: counter.calls,
          latencyMs: Math.round(performance.now() - started),
          promptTokens: counter.promptTokens,
        },
      };
      });
    },
  };
}

export const reactStrategy: ReasoningStrategy = createReactStrategy();
