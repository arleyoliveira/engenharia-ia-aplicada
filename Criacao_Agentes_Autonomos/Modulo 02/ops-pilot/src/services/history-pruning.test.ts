import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryConversationStore } from "../store/memory-conversation-store.js";
import {
  HISTORY_WINDOW,
  PRUNE_BATCH_SIZE,
} from "./compose-chat-prompt.js";
import { maybeConsolidate } from "./history-pruning.js";
import { createFakeHistorySummarizer } from "./history-summarizer.js";

describe("history-pruning", () => {
  it("≤8 msgs → não consolida", async () => {
    const conversation = new MemoryConversationStore();
    const summarizer = createFakeHistorySummarizer();
    const id = conversation.create();
    for (let i = 0; i < HISTORY_WINDOW; i += 1) {
      conversation.append(id, {
        role: i % 2 === 0 ? "user" : "assistant",
        content: `m${i}`,
      });
    }
    const history = conversation.lastMessages(id, HISTORY_WINDOW);
    const result = await maybeConsolidate({
      conversationId: id,
      conversation,
      history,
      summarizer,
    });
    assert.equal(result.didSummarize, false);
    assert.equal(summarizer.calls.length, 0);
    assert.equal(conversation.getSummary(id), null);
  });

  it("8 candidatos → consolida uma vez e atualiza cursor", async () => {
    const conversation = new MemoryConversationStore();
    const summarizer = createFakeHistorySummarizer();
    const id = conversation.create();
    for (let i = 0; i < HISTORY_WINDOW + PRUNE_BATCH_SIZE; i += 1) {
      conversation.append(id, {
        role: i % 2 === 0 ? "user" : "assistant",
        content: `m${i}`,
      });
    }
    const history = conversation.lastMessages(id, HISTORY_WINDOW);
    const result = await maybeConsolidate({
      conversationId: id,
      conversation,
      history,
      summarizer,
    });
    assert.equal(result.didSummarize, true);
    assert.equal(summarizer.calls.length, 1);
    const summary = conversation.getSummary(id);
    assert.ok(summary);
    assert.equal(summary.coveredThroughMessageId, history[0]!.id - 1);
    // Re-run sem novos candidatos → não consolida de novo
    const again = await maybeConsolidate({
      conversationId: id,
      conversation,
      history,
      summarizer,
    });
    assert.equal(again.didSummarize, false);
    assert.equal(summarizer.calls.length, 1);
  });

  it("mescla passa previous ao summarizer", async () => {
    const conversation = new MemoryConversationStore();
    const summarizer = createFakeHistorySummarizer();
    const id = conversation.create();
    for (let i = 0; i < HISTORY_WINDOW + PRUNE_BATCH_SIZE; i += 1) {
      conversation.append(id, {
        role: i % 2 === 0 ? "user" : "assistant",
        content: `a${i}`,
      });
    }
    const history1 = conversation.lastMessages(id, HISTORY_WINDOW);
    await maybeConsolidate({
      conversationId: id,
      conversation,
      history: history1,
      summarizer,
    });
    const firstText = conversation.getSummary(id)?.text;
    assert.ok(firstText);

    for (let i = 0; i < PRUNE_BATCH_SIZE; i += 1) {
      conversation.append(id, {
        role: i % 2 === 0 ? "user" : "assistant",
        content: `b${i}`,
      });
    }
    const history2 = conversation.lastMessages(id, HISTORY_WINDOW);
    await maybeConsolidate({
      conversationId: id,
      conversation,
      history: history2,
      summarizer,
    });
    assert.equal(summarizer.calls.length, 2);
    assert.equal(summarizer.calls[1]?.previous, firstText);
  });
});
