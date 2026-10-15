/**
 * Elegibilidade e consolidação do histórico (lote de 8 fora da janela).
 */
import type { ConversationMessage, ConversationStore } from "../store/conversation-store.js";
import {
  HISTORY_WINDOW,
  PRUNE_BATCH_SIZE,
} from "./compose-chat-prompt.js";
import type { HistorySummarizer } from "./history-summarizer.js";

export type ConsolidateResult = {
  summaryText?: string;
  didSummarize: boolean;
  summarizeContent?: string;
};

export async function maybeConsolidate(args: {
  conversationId: string;
  conversation: ConversationStore;
  history: readonly ConversationMessage[];
  summarizer: HistorySummarizer;
}): Promise<ConsolidateResult> {
  const { conversationId, conversation, history, summarizer } = args;
  const prior = conversation.getSummary(conversationId);
  const priorText = prior?.text;

  if (history.length < HISTORY_WINDOW) {
    return {
      summaryText: priorText,
      didSummarize: false,
    };
  }

  const oldestInWindow = history[0];
  if (!oldestInWindow) {
    return { summaryText: priorText, didSummarize: false };
  }

  const coveredId = prior?.coveredThroughMessageId ?? 0;
  const candidates = conversation.messagesBefore(
    conversationId,
    oldestInWindow.id,
    coveredId,
    PRUNE_BATCH_SIZE,
  );

  if (candidates.length < PRUNE_BATCH_SIZE) {
    return {
      summaryText: priorText,
      didSummarize: false,
    };
  }

  const batch = candidates.slice(0, PRUNE_BATCH_SIZE);
  const last = batch[batch.length - 1];
  if (!last) {
    return { summaryText: priorText, didSummarize: false };
  }

  const text = await summarizer.summarize({
    previous: priorText,
    batch: batch.map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
  });

  conversation.upsertSummary(conversationId, {
    text,
    coveredThroughMessageId: last.id,
  });

  return {
    summaryText: text,
    didSummarize: true,
    summarizeContent: text,
  };
}
