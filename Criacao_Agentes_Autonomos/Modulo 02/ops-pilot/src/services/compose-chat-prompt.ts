import type {
  ChatHistoryMessage,
  ChatTurnInput,
  StrategyInput,
} from "../agents/types.js";

/** Janela de histórico cru injetada no prompt (spec 011). */
export const HISTORY_WINDOW = 8;

/** Lote de mensagens fora da janela que dispara consolidação. */
export const PRUNE_BATCH_SIZE = 8;

/** Alvo aproximado do resumo vigente (`estimateTokens`). */
export const SUMMARY_TARGET_TOKENS = 150;

export function normalizeChatTurnInput(input: StrategyInput): ChatTurnInput {
  if (typeof input === "string") {
    return { message: input, history: [] };
  }
  return {
    message: input.message,
    history: input.history ?? [],
    memories: input.memories,
    summary: input.summary,
  };
}

function formatSummaryBlock(summary: string | undefined): string[] {
  const text = summary?.trim() ?? "";
  if (text.length === 0) {
    return [];
  }
  return ["Resumo da conversa:", text, ""];
}

function formatMemoriesBlock(memories: readonly string[]): string[] {
  if (memories.length === 0) {
    return [];
  }
  return [
    "Memórias relevantes:",
    ...memories.map((fact) => `- ${fact}`),
    "",
  ];
}

/** Texto único para estratégias que ainda consomem um prompt string. */
export function composeChatPrompt(input: StrategyInput): string {
  const turn = normalizeChatTurnInput(input);
  const history = turn.history ?? [];
  const memories = turn.memories ?? [];
  const summaryLines = formatSummaryBlock(turn.summary);
  const memoryLines = formatMemoriesBlock(memories);

  if (
    history.length === 0 &&
    memoryLines.length === 0 &&
    summaryLines.length === 0
  ) {
    return turn.message;
  }

  const parts: string[] = [...summaryLines, ...memoryLines];

  if (history.length > 0) {
    const lines = history.map(
      (entry) => `${entry.role}: ${entry.content}`,
    );
    parts.push(
      "Histórico da conversa:",
      ...lines,
      "",
      "Mensagem atual:",
      turn.message,
    );
  } else {
    parts.push(turn.message);
  }

  return parts.join("\n");
}

/** Mensagens role/content para o agente (histórico + mensagem atual). */
export function toAgentMessages(
  input: StrategyInput,
): Array<{ role: "user" | "assistant"; content: string }> {
  const turn = normalizeChatTurnInput(input);
  const history = (turn.history ?? []) as readonly ChatHistoryMessage[];
  const memories = turn.memories ?? [];
  const prefix = [
    ...formatSummaryBlock(turn.summary),
    ...formatMemoriesBlock(memories),
  ].join("\n");
  const userContent =
    prefix.length > 0 ? `${prefix}${turn.message}` : turn.message;

  return [
    ...history.map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
    { role: "user" as const, content: userContent },
  ];
}
