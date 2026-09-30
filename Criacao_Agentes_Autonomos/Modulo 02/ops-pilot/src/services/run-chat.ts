import { collectFallbacks } from "../agents/model.js";
import type { StrategyResult, StrategyRunOptions } from "../agents/types.js";
import {
  runProductionGraph,
  type ProductionGraphDeps,
  type ProductionRoute,
} from "../graph/production-Graph.js";
import type { ConversationStore } from "../store/conversation-store.js";
import type { MemoryStore } from "../memory-store.js";
import { createForgetPreferenceTool } from "../agents/memory-tools.js";
import { createDefaultOpsTools } from "../agents/tools.js";
import {
  resolveSectionBudgets,
  type SectionBudgets,
} from "../context/context-builder.js";
import { HISTORY_WINDOW } from "./compose-chat-prompt.js";
import { maybeConsolidate } from "./history-pruning.js";
import type { HistorySummarizer } from "./history-summarizer.js";
import {
  scheduleLearningRemember,
  type LearningReflectorDeps,
} from "./learning-reflector.js";

export interface ChatInput {
  message: string;
  conversationId?: string;
  userId?: string;
  strategy?: ProductionRoute;
  reflect?: boolean;
}

export interface RunChatDeps extends ProductionGraphDeps {
  conversation: ConversationStore;
  memory?: MemoryStore;
  /** Injeção do refletor (distill/schedule fakes nos testes). */
  learning?: LearningReflectorDeps;
  /** Sumarizador de histórico (fake nos testes; LLM em produção). */
  summarizer?: HistorySummarizer;
  /** Tools base; default = createDefaultOpsTools() quando há memory+userId. */
  baseTools?: readonly unknown[];
  /** Tetos por seção (testes); produção usa `resolveSectionBudgets(process.env)`. */
  sectionBudgets?: SectionBudgets;
}

export type ChatOutput = StrategyResult & {
  conversationId: string;
};

/**
 * Orquestra um turn de chat com conversa persistente, pruning/resumo opcional,
 * recall semântico, tools de memória e aprendizado assíncrono pós-sucesso.
 */
export async function runChat(
  input: ChatInput,
  deps: RunChatDeps,
): Promise<ChatOutput> {
  const conversationId =
    input.conversationId ?? deps.conversation.create();

  const history = deps.conversation.lastMessages(
    conversationId,
    HISTORY_WINDOW,
  );

  const { value: result, events: fallbackEvents } = await collectFallbacks(async () => {
    let summaryText: string | undefined;
    let didSummarize = false;
    let summarizeContent: string | undefined;

    if (deps.summarizer) {
      const consolidation = await maybeConsolidate({
        conversationId,
        conversation: deps.conversation,
        history,
        summarizer: deps.summarizer,
      });
      summaryText = consolidation.summaryText;
      didSummarize = consolidation.didSummarize;
      summarizeContent = consolidation.summarizeContent;
    } else {
      summaryText =
        deps.conversation.getSummary(conversationId)?.text ?? undefined;
    }

    const memoryHits =
      input.userId && deps.memory
        ? await deps.memory.recall(input.userId, input.message)
        : [];

    const budgets =
      deps.sectionBudgets ?? resolveSectionBudgets(process.env);

    deps.conversation.append(conversationId, {
      role: "user",
      content: input.message,
    });

    const runOptions: StrategyRunOptions | undefined =
      input.userId && deps.memory
        ? {
            tools: [
              ...(deps.baseTools ?? (await createDefaultOpsTools())),
              createForgetPreferenceTool({
                memory: deps.memory,
                userId: input.userId,
              }),
            ],
          }
        : undefined;

    return runProductionGraph(
      {
        message: input.message,
        history: history.map((entry) => ({
          role: entry.role,
          content: entry.content,
        })),
        memories: memoryHits.map((hit) => ({
          fact: hit.fact,
          score: hit.score,
        })),
        summary: summaryText,
        summarizeContent: didSummarize
          ? (summarizeContent ?? summaryText ?? "")
          : undefined,
        budgets,
        strategy: input.strategy,
        reflect: input.reflect,
        tools: runOptions?.tools,
      },
      {
        strategies: deps.strategies,
        routeModel: deps.routeModel,
        critic: deps.critic,
      },
    );
  });

  deps.conversation.append(conversationId, {
    role: "assistant",
    content: result.answer,
  });

  if (input.userId && deps.memory) {
    scheduleLearningRemember(
      { userId: input.userId, userMessage: input.message },
      deps.memory,
      deps.learning,
    );
  }

  return {
    conversationId,
    answer: result.answer,
    trace: [...result.trace, ...fallbackEvents],
    metrics: {
      ...result.metrics,
      promptTokens: result.metrics.promptTokens ?? 0,
      fallbacks: fallbackEvents.length,
    },
  };
}
