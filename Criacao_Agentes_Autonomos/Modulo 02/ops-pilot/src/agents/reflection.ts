/**
 * Camada de Reflection (withReflection): decora qualquer ReasoningStrategy
 * adicionando crítica e auto-correção contextual com base nas observações do trace.
 */
import { z } from "zod";
import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import type {
  CritiqueResult,
  ReasoningStrategy,
  ReflectionOptions,
  StrategyResult,
  StrategyRunOptions,
  TraceEvent,
} from "./types.js";
import { createModel } from "./model.js";
import { createLlmCallCounter } from "./metrics.js";
import { ModelOutputError } from "../errors.js";

const DEFAULT_MAX_REFLECTIONS = 2;

export const veredictSchema = z.object({
  approved: z.boolean(),
  feedback: z.string().describe("se aprovado; o que corrigir, em especifico e acionável"),
});

export const critiqueSchema = veredictSchema;

export const CRITIC_PROMPT = `Você é o crítico de qualidade do OpsPilot, copilot de plantão.
Sua responsabilidade é avaliar se a resposta proposta pelo agente é factualmente consistente com as observações reais obtidas das ferramentas e se atende completamente ao objetivo solicitado pelo plantonista.

Critérios de Avaliação:
1. Factualidade: avalie APENAS contra as observações do trace e do pedido. Não aceite afirmações sem evidência nas observações.
2. Completude: todos os pontos do objetivo do plantonista foram atendidos na ordem correta?
3. Ações inexistentes: a resposta não deve inventar dados sobre serviços ou alertas ausentes nas observações.

Se aprovado, retorne approved=true com justificativa concisa no feedback.
Se reprovado, retorne approved=false e indique no feedback, de forma específica e acionável, o que corrigir.`;

/** Extrai e formata todas as observações registradas no trace. */
export function extractObservations(trace: TraceEvent[]): string {
  const observations = trace
    .filter((event): event is { type: "observation"; content: string } => event.type === "observation")
    .map((event) => event.content);

  return observations.length > 0 ? observations.join("\n") : "(nenhuma observação)";
}

export const observationsOf = extractObservations;

export interface CriticDependencies {
  model?: BaseLanguageModel;
}

/** Avalia a resposta candidata contra o pedido e as observações do trace. */
export async function critique(
  input: string,
  result: StrategyResult,
  deps?: CriticDependencies,
  callbacks?: unknown[],
): Promise<CritiqueResult> {
  const model = deps?.model ?? createModel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const criticStructured = (model as any).withStructuredOutput(critiqueSchema, {
    method: "functionCalling",
  });

  const obs = observationsOf(result.trace);
  const promptMessages = [
    { role: "system", content: CRITIC_PROMPT },
    {
      role: "user",
      content: `Pedido: ${input}\nObservações: ${obs}\nResposta: ${result.answer}`,
    },
  ];

  try {
    const outcome = await criticStructured.invoke(promptMessages, {
      callbacks: callbacks as never,
    });
    if (outcome && typeof outcome.approved === "boolean") {
      return outcome;
    }
    throw new Error("Veredito malformado retornado pelo modelo.");
  } catch (error) {
    if (error instanceof ModelOutputError) {
      throw error;
    }
    throw new ModelOutputError(
      `Falha na avaliação do crítico: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Decora qualquer ReasoningStrategy com uma camada de reflexão autônoma.
 */
export function withReflection(
  strategy: ReasoningStrategy,
  options?: ReflectionOptions,
  deps?: CriticDependencies,
): ReasoningStrategy {
  const maxReflections = options?.maxReflections ?? DEFAULT_MAX_REFLECTIONS;
  const name = options?.name ?? `reflect:${strategy.name}`;

  return {
    name,
    async run(input: string, runOptions?: StrategyRunOptions): Promise<StrategyResult> {
      const startTime = performance.now();
      const counter = createLlmCallCounter();
      const traceAccumulator: TraceEvent[] = [];
      let totalLlmCalls = 0;

      let currentInput = input;
      let lastResult: StrategyResult | null = null;
      let reflectionCount = 0;

      while (true) {
        const baseResult = await strategy.run(currentInput, runOptions);
        totalLlmCalls += baseResult.metrics.llmCalls;
        lastResult = baseResult;

        // Adiciona os eventos da execução base (exceto answer intermediário se houver)
        for (const event of baseResult.trace) {
          if (event.type !== "answer") {
            traceAccumulator.push(event);
          }
        }

        if (maxReflections <= 0) {
          traceAccumulator.push({ type: "answer", content: baseResult.answer });
          return {
            answer: baseResult.answer,
            trace: traceAccumulator,
            metrics: {
              llmCalls: totalLlmCalls,
              latencyMs: Math.round(performance.now() - startTime),
            },
          };
        }

        const evaluation = await critique(
          input,
          baseResult,
          deps,
          [counter.handler],
        );

        const statusTag = evaluation.approved ? "[APROVADO]" : "[REPROVADO]";
        traceAccumulator.push({
          type: "critique",
          content: `${statusTag} ${evaluation.feedback}`,
        });

        if (evaluation.approved) {
          traceAccumulator.push({ type: "answer", content: baseResult.answer });
          return {
            answer: baseResult.answer,
            trace: traceAccumulator,
            metrics: {
              llmCalls: totalLlmCalls + counter.calls,
              latencyMs: Math.round(performance.now() - startTime),
            },
          };
        }

        reflectionCount += 1;
        if (reflectionCount >= maxReflections) {
          traceAccumulator.push({
            type: "critique",
            content: `[LIMITE ATINGIDO] Limite de reflexões (${maxReflections}) atingido.`,
          });
          traceAccumulator.push({ type: "answer", content: baseResult.answer });
          return {
            answer: baseResult.answer,
            trace: traceAccumulator,
            metrics: {
              llmCalls: totalLlmCalls + counter.calls,
              latencyMs: Math.round(performance.now() - startTime),
            },
          };
        }

        currentInput = `${input}\n\n[Feedback do Crítico na tentativa anterior]: ${evaluation.feedback}\nPor favor, reavalie e corrija a resposta considerando este feedback.`;
      }
    },
  };
}
