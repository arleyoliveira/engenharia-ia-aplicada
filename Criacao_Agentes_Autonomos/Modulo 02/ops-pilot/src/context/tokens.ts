/** Estimativa de tokens e leitura de usage do LangChain. Sem IO. */

export interface ContextBreakdown {
  message: number;
  history: number;
  memories: number;
  summary: number;
}

export interface ContextBreakdownInput {
  message: string;
  history: readonly { content: string }[];
  memories: readonly string[];
  summary?: string;
}

/** `floor(caracteres / 4)` — comprimento da string, não bytes. */
export function estimateTokens(text: string): number {
  return Math.floor(text.length / 4);
}

/**
 * Partição estimada do contexto montado pelo chat.
 * Soma por fonte; rótulos de papel / cabeçalhos ficam de fora.
 */
export function estimateContextBreakdown(
  input: ContextBreakdownInput,
): ContextBreakdown {
  return {
    message: estimateTokens(input.message),
    history: input.history.reduce(
      (sum, entry) => sum + estimateTokens(entry.content),
      0,
    ),
    memories: input.memories.reduce(
      (sum, fact) => sum + estimateTokens(fact),
      0,
    ),
    summary: estimateTokens(input.summary ?? ""),
  };
}

function asNonNegativeInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}

function firstGenerationMessage(output: Record<string, unknown>): unknown {
  const generations = output.generations;
  if (!Array.isArray(generations) || generations.length === 0) {
    return undefined;
  }
  const firstRow = generations[0];
  if (!Array.isArray(firstRow) || firstRow.length === 0) {
    return undefined;
  }
  const generation = firstRow[0];
  if (!generation || typeof generation !== "object") {
    return undefined;
  }
  return (generation as { message?: unknown }).message;
}

/**
 * Um inteiro ≥ 0 por `handleLLMEnd`.
 * Prioridade: llmOutput.tokenUsage.promptTokens → usage_metadata.input_tokens
 * (1ª generation) → response_metadata.tokenUsage.promptTokens.
 * Não soma tokenUsage com usage_metadata da mesma chamada.
 * Ignora estimatedTokenUsage.
 */
export function promptTokensFromLlmEnd(output: unknown): number {
  if (!output || typeof output !== "object") {
    return 0;
  }
  const record = output as Record<string, unknown>;
  const llmOutput = record.llmOutput;
  if (llmOutput && typeof llmOutput === "object") {
    const tokenUsage = (llmOutput as { tokenUsage?: { promptTokens?: unknown } })
      .tokenUsage;
    const fromTokenUsage = asNonNegativeInt(tokenUsage?.promptTokens);
    if (fromTokenUsage !== undefined) {
      return fromTokenUsage;
    }
  }

  const message = firstGenerationMessage(record);
  if (message && typeof message === "object") {
    const usage = (message as { usage_metadata?: { input_tokens?: unknown } })
      .usage_metadata;
    const fromUsage = asNonNegativeInt(usage?.input_tokens);
    if (fromUsage !== undefined) {
      return fromUsage;
    }

    const responseMeta = (
      message as {
        response_metadata?: { tokenUsage?: { promptTokens?: unknown } };
      }
    ).response_metadata;
    const fromResponse = asNonNegativeInt(
      responseMeta?.tokenUsage?.promptTokens,
    );
    if (fromResponse !== undefined) {
      return fromResponse;
    }
  }

  return 0;
}
