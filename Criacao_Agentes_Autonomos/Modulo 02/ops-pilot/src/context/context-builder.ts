/** ContextBuilder: orçamento por seção. Funções puras — sem IO. */

import type { ChatHistoryMessage } from "../agents/types.js";
import {
  estimateContextBreakdown,
  estimateTokens,
  type ContextBreakdown,
} from "./tokens.js";

export interface SectionBudgets {
  summary: number;
  window: number;
  memories: number;
}

export interface MemoryCandidate {
  fact: string;
  score: number;
}

/** Entrada já resolvida (IO fica em `runChat`: summary, lastMessages, recall). */
export interface ContextBuilderInput {
  system?: string;
  message: string;
  summary?: string;
  history: readonly ChatHistoryMessage[];
  memories: readonly MemoryCandidate[];
}

export interface BudgetedContext {
  system?: string;
  message: string;
  summary?: string;
  history: ChatHistoryMessage[];
  memories: string[];
}

/** Resultado de `assemble` / `buildContext`: seções orçadas + breakdown. */
export interface BuiltContext extends BudgetedContext {
  breakdown: ContextBreakdown;
}

export const DEFAULT_SECTION_BUDGETS: SectionBudgets = {
  summary: 200,
  window: 1200,
  memories: 300,
};

type CutPolicy = "never" | "prefix" | "oldest-first" | "lowest-score-first";

type SectionName = "system" | "summary" | "history" | "memories" | "message";

interface TextSection {
  name: SectionName;
  value: unknown;
  budget: number;
  cut: CutPolicy;
}

function section(
  name: SectionName,
  value: unknown,
  opts: { budget: number; cut: CutPolicy },
): TextSection {
  return { name, value, budget: opts.budget, cut: opts.cut };
}

function parsePositiveInt(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    return undefined;
  }
  return n;
}

/**
 * Lê `CONTEXT_BUDGET_SUMMARY` / `WINDOW` / `MEMORIES`.
 * Inválido ou ausente → padrão da seção.
 */
export function resolveSectionBudgets(
  env: Record<string, string | undefined> = {},
): SectionBudgets {
  return {
    summary:
      parsePositiveInt(env.CONTEXT_BUDGET_SUMMARY) ??
      DEFAULT_SECTION_BUDGETS.summary,
    window:
      parsePositiveInt(env.CONTEXT_BUDGET_WINDOW) ??
      DEFAULT_SECTION_BUDGETS.window,
    memories:
      parsePositiveInt(env.CONTEXT_BUDGET_MEMORIES) ??
      DEFAULT_SECTION_BUDGETS.memories,
  };
}

/** Prefixo até `estimateTokens(text) ≤ budget`. Vazio → undefined. */
export function trimSummaryToBudget(
  text: string | undefined,
  budget: number,
): string | undefined {
  if (text === undefined) {
    return undefined;
  }
  const trimmed = text.trimEnd();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (estimateTokens(trimmed) <= budget) {
    return trimmed;
  }
  let candidate = trimmed.slice(0, 4 * budget + 3);
  while (candidate.length > 0 && estimateTokens(candidate) > budget) {
    candidate = candidate.slice(0, -1);
  }
  candidate = candidate.replace(/\s+$/u, "");
  return candidate.length > 0 ? candidate : undefined;
}

/** Remove mais antigas (índice 0) até caber; item individual > teto não entra. */
export function trimWindowOldestFirst(
  history: readonly ChatHistoryMessage[],
  budget: number,
): ChatHistoryMessage[] {
  const kept = history
    .filter((entry) => estimateTokens(entry.content) <= budget)
    .map((entry) => ({ role: entry.role, content: entry.content }));

  const tokensOf = (list: ChatHistoryMessage[]) =>
    list.reduce((sum, entry) => sum + estimateTokens(entry.content), 0);

  while (kept.length > 0 && tokensOf(kept) > budget) {
    kept.shift();
  }
  return kept;
}

/**
 * Remove menor score até caber; empate → pior ranking (último entre empatados).
 * Fato individual > teto não entra. Ordem relativa dos sobreviventes preservada.
 */
export function trimMemoriesLowestScoreFirst(
  memories: readonly MemoryCandidate[],
  budget: number,
): string[] {
  const eligible = memories
    .map((hit, rank) => ({ ...hit, rank }))
    .filter((hit) => estimateTokens(hit.fact) <= budget);

  const tokensOf = (list: typeof eligible) =>
    list.reduce((sum, hit) => sum + estimateTokens(hit.fact), 0);

  while (eligible.length > 0 && tokensOf(eligible) > budget) {
    let removeAt = 0;
    for (let i = 1; i < eligible.length; i += 1) {
      const cur = eligible[i]!;
      const best = eligible[removeAt]!;
      if (
        cur.score < best.score ||
        (cur.score === best.score && cur.rank > best.rank)
      ) {
        removeAt = i;
      }
    }
    eligible.splice(removeAt, 1);
  }

  eligible.sort((a, b) => a.rank - b.rank);
  return eligible.map((hit) => hit.fact);
}

/** Aplica teto e regra de corte por seção. */
export function fitToBudget(sec: TextSection): unknown {
  switch (sec.cut) {
    case "never":
      return sec.value;
    case "prefix":
      return trimSummaryToBudget(sec.value as string | undefined, sec.budget);
    case "oldest-first":
      return trimWindowOldestFirst(
        sec.value as readonly ChatHistoryMessage[],
        sec.budget,
      );
    case "lowest-score-first":
      return trimMemoriesLowestScoreFirst(
        sec.value as readonly MemoryCandidate[],
        sec.budget,
      );
    default: {
      const _exhaustive: never = sec.cut;
      return _exhaustive;
    }
  }
}

type FittedBag = {
  system?: string;
  summary?: string;
  history: ChatHistoryMessage[];
  memories: string[];
};

/**
 * Junta seções orçadas + mensagem intocável e calcula breakdown por seção.
 */
export function assemble(fitted: FittedBag, message: string): BuiltContext {
  const context: BudgetedContext = {
    message,
    history: fitted.history,
    memories: fitted.memories,
  };
  if (fitted.system !== undefined) {
    context.system = fitted.system;
  }
  if (fitted.summary !== undefined && fitted.summary.length > 0) {
    context.summary = fitted.summary;
  }

  return {
    ...context,
    breakdown: estimateContextBreakdown({
      message: context.message,
      history: context.history,
      memories: context.memories,
      summary: context.summary,
    }),
  };
}

/**
 * Sketch: sections → map(fitToBudget) → assemble(..., message) com breakdown.
 * IO (summaryOf / lastMessages / recall) permanece em `runChat`.
 * Summary usa `prefix` (teto CONTEXT_BUDGET_SUMMARY), não `never` — spec 012.
 */
export function buildContext(
  input: ContextBuilderInput,
  budgets: SectionBudgets = DEFAULT_SECTION_BUDGETS,
): BuiltContext {
  const sections: TextSection[] = [
    section("system", input.system, {
      budget: Number.POSITIVE_INFINITY,
      cut: "never",
    }),
    section("summary", input.summary, {
      budget: budgets.summary,
      cut: "prefix",
    }),
    section("history", input.history, {
      budget: budgets.window,
      cut: "oldest-first",
    }),
    section("memories", input.memories, {
      budget: budgets.memories,
      cut: "lowest-score-first",
    }),
  ];

  const fittedValues = sections.map(fitToBudget);
  const fitted: FittedBag = {
    system: fittedValues[0] as string | undefined,
    summary: fittedValues[1] as string | undefined,
    history: fittedValues[2] as ChatHistoryMessage[],
    memories: fittedValues[3] as string[],
  };

  return assemble(fitted, input.message);
}

/** Alias do contrato / tasks (`buildBudgetedContext`). */
export function buildBudgetedContext(
  input: ContextBuilderInput,
  budgets: SectionBudgets,
): BudgetedContext {
  const built = buildContext(input, budgets);
  const { breakdown: _breakdown, ...budgeted } = built;
  return budgeted;
}
