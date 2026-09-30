import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NotFoundError } from "../errors.js";
import type {
  ReasoningStrategy,
  StrategyInput,
  StrategyRunOptions,
} from "../agents/types.js";
import { MemoryConversationStore } from "../store/memory-conversation-store.js";
import { InMemoryMemoryStore } from "../memory-store.js";
import { HISTORY_WINDOW } from "./compose-chat-prompt.js";
import {
  estimateContextBreakdown,
  estimateTokens,
} from "../context/tokens.js";
import { noteFallback } from "../agents/model.js";
import { runChat } from "./run-chat.js";
import type { ProductionRoute } from "../graph/production-Graph.js";

function graphFor(strategy: ReasoningStrategy) {
  const idle: ReasoningStrategy = {
    name: "idle",
    async run() {
      throw new Error("nó de estratégia indevido");
    },
  };
  return {
    strategies: {
      react: strategy,
      planExecute: idle,
      reflect: idle,
      team: idle,
    },
    routeModel: {
      async invoke() {
        return { route: "react" as ProductionRoute, reason: "teste" };
      },
    },
  };
}

function createFakeStrategy(options?: {
  promptTokens?: number;
}): ReasoningStrategy & {
  lastInput: StrategyInput | null;
  lastOptions: StrategyRunOptions | undefined;
} {
  const fake: ReasoningStrategy & {
    lastInput: StrategyInput | null;
    lastOptions: StrategyRunOptions | undefined;
  } = {
    name: "fake",
    lastInput: null,
    lastOptions: undefined,
    async run(input, runOptions) {
      fake.lastInput = input;
      fake.lastOptions = runOptions;
      const message = typeof input === "string" ? input : input.message;
      return {
        answer: `eco:${message}`,
        trace: [{ type: "answer", content: `eco:${message}` }],
        metrics: {
          llmCalls: 0,
          latencyMs: 1,
          ...(options?.promptTokens !== undefined
            ? { promptTokens: options.promptTokens }
            : {}),
        },
      };
    },
  };
  return fake;
}

describe("runChat", () => {
  it("cria conversationId, historyMessages 0 e persiste par user/assistant", async () => {
    const conversation = new MemoryConversationStore();
    const strategy = createFakeStrategy();

    const result = await runChat(
      { message: "olá" },
      { conversation, ...graphFor(strategy) },
    );

    assert.ok(result.conversationId.length > 0);
    assert.equal(result.metrics.historyMessages, 0);
    assert.equal(result.metrics.promptTokens, 0);
    assert.deepEqual(result.metrics.contextBreakdown, {
      message: estimateTokens("olá"),
      history: 0,
      memories: 0,
      summary: 0,
    });
    assert.equal(result.answer, "eco:olá");

    const stored = conversation.lastMessages(result.conversationId, 12);
    assert.equal(stored.length, 2);
    assert.equal(stored[0]?.role, "user");
    assert.equal(stored[1]?.role, "assistant");
  });

  it("reutiliza conversationId e passa history para strategy.run", async () => {
    const conversation = new MemoryConversationStore();
    const strategy = createFakeStrategy();

    const first = await runChat(
      { message: "primeiro" },
      { conversation, ...graphFor(strategy) },
    );
    const second = await runChat(
      { message: "segundo", conversationId: first.conversationId },
      { conversation, ...graphFor(strategy) },
    );

    assert.equal(second.conversationId, first.conversationId);
    assert.equal(second.metrics.historyMessages, 2);
    assert.ok(strategy.lastInput && typeof strategy.lastInput !== "string");
    assert.equal(strategy.lastInput.message, "segundo");
    assert.equal(strategy.lastInput.history?.length, 2);
  });

  it("conversationId inexistente → NotFoundError", async () => {
    const conversation = new MemoryConversationStore();
    const strategy = createFakeStrategy();

    await assert.rejects(
      () =>
        runChat(
          { message: "x", conversationId: "missing-id" },
          { conversation, ...graphFor(strategy) },
        ),
      NotFoundError,
    );
  });

  it("janela HISTORY_WINDOW: historyMessages === HISTORY_WINDOW com overflow", async () => {
    const conversation = new MemoryConversationStore();
    const strategy = createFakeStrategy();
    const id = conversation.create();

    for (let i = 0; i < HISTORY_WINDOW + 4; i += 1) {
      conversation.append(id, {
        role: i % 2 === 0 ? "user" : "assistant",
        content: `m${i}`,
      });
    }

    const result = await runChat(
      { message: "novo", conversationId: id },
      { conversation, ...graphFor(strategy) },
    );

    assert.equal(result.metrics.historyMessages, HISTORY_WINDOW);
    assert.ok(strategy.lastInput && typeof strategy.lastInput !== "string");
    assert.equal(strategy.lastInput.history?.length, HISTORY_WINDOW);
    assert.equal(
      result.trace.some((event) => event.type === "summarize"),
      false,
    );
  });

  it("sem summarizer: só janela, sem consolidação mesmo com 16 msgs", async () => {
    const conversation = new MemoryConversationStore();
    const strategy = createFakeStrategy();
    const id = conversation.create();
    for (let i = 0; i < 16; i += 1) {
      conversation.append(id, {
        role: i % 2 === 0 ? "user" : "assistant",
        content: `m${i}`,
      });
    }

    const result = await runChat(
      { message: "novo", conversationId: id },
      { conversation, ...graphFor(strategy) },
    );

    assert.equal(result.metrics.historyMessages, HISTORY_WINDOW);
    assert.equal(conversation.getSummary(id), null);
    assert.equal(
      result.trace.some((event) => event.type === "summarize"),
      false,
    );
  });

  it("consolidação no 1º lote: summary no input, evento summarize, breakdown.summary > 0", async () => {
    const { createFakeHistorySummarizer } = await import(
      "./history-summarizer.js"
    );
    const { PRUNE_BATCH_SIZE } = await import("./compose-chat-prompt.js");
    const conversation = new MemoryConversationStore();
    const strategy = createFakeStrategy();
    const summarizer = createFakeHistorySummarizer();
    const id = conversation.create();

    for (let i = 0; i < HISTORY_WINDOW + PRUNE_BATCH_SIZE; i += 1) {
      conversation.append(id, {
        role: i % 2 === 0 ? "user" : "assistant",
        content: `decisão fato pendência m${i}`,
      });
    }

    const result = await runChat(
      { message: "novo", conversationId: id },
      { conversation, ...graphFor(strategy), summarizer },
    );

    assert.equal(result.metrics.historyMessages, HISTORY_WINDOW);
    assert.equal(summarizer.calls.length, 1);
    assert.ok(strategy.lastInput && typeof strategy.lastInput !== "string");
    assert.ok(strategy.lastInput.summary);
    assert.equal(result.trace[0]?.type, "summarize");
    assert.ok((result.metrics.contextBreakdown?.summary ?? 0) > 0);
    assert.ok(conversation.getSummary(id)?.text);
  });

  it("mid-lote: não re-sumariza; 2º lote mescla com previous", async () => {
    const { createFakeHistorySummarizer } = await import(
      "./history-summarizer.js"
    );
    const { PRUNE_BATCH_SIZE } = await import("./compose-chat-prompt.js");
    const conversation = new MemoryConversationStore();
    const strategy = createFakeStrategy();
    const summarizer = createFakeHistorySummarizer();
    const id = conversation.create();

    for (let i = 0; i < HISTORY_WINDOW + PRUNE_BATCH_SIZE; i += 1) {
      conversation.append(id, {
        role: i % 2 === 0 ? "user" : "assistant",
        content: `lote1-${i}`,
      });
    }

    const first = await runChat(
      { message: "após-lote1", conversationId: id },
      { conversation, ...graphFor(strategy), summarizer },
    );
    assert.equal(summarizer.calls.length, 1);
    assert.equal(first.trace[0]?.type, "summarize");
    const summaryAfterFirst = conversation.getSummary(id)?.text;
    assert.ok(summaryAfterFirst);

    for (let t = 0; t < 3; t += 1) {
      const mid = await runChat(
        { message: `mid-${t}`, conversationId: id },
        { conversation, ...graphFor(strategy), summarizer },
      );
      assert.equal(summarizer.calls.length, 1);
      assert.equal(
        mid.trace.some((event) => event.type === "summarize"),
        false,
      );
      assert.ok(strategy.lastInput && typeof strategy.lastInput !== "string");
      assert.equal(strategy.lastInput.summary, summaryAfterFirst);
    }

    // 16 + 2 + 6 = 24 msgs → próximo turn consolida 2º lote
    const second = await runChat(
      { message: "após-lote2", conversationId: id },
      { conversation, ...graphFor(strategy), summarizer },
    );

    assert.equal(summarizer.calls.length, 2);
    assert.equal(second.trace[0]?.type, "summarize");
    assert.equal(summarizer.calls[1]?.previous, summaryAfterFirst);
  });

  it("com userId + memory: injeta memories e recalledMemories", async () => {
    const conversation = new MemoryConversationStore();
    const memory = new InMemoryMemoryStore();
    memory.seedRecall("alice", ["prefiro alertas em português"]);
    const strategy = createFakeStrategy();

    const result = await runChat(
      { message: "idioma?", userId: "alice" },
      { conversation, ...graphFor(strategy), memory, baseTools: [], learning: { distill: async () => ({ hasLearning: false, fact: "" }) } },
    );

    assert.equal(result.metrics.recalledMemories, 1);
    assert.ok(strategy.lastInput && typeof strategy.lastInput !== "string");
    assert.deepEqual(strategy.lastInput.memories, [
      "prefiro alertas em português",
    ]);
  });

  it("sem userId: recalledMemories 0 e sem memories", async () => {
    const conversation = new MemoryConversationStore();
    const memory = new InMemoryMemoryStore();
    memory.seedRecall("alice", ["não deve aparecer"]);
    const strategy = createFakeStrategy();

    const result = await runChat(
      { message: "oi" },
      { conversation, ...graphFor(strategy), memory },
    );

    assert.equal(result.metrics.recalledMemories, 0);
    assert.ok(strategy.lastInput && typeof strategy.lastInput !== "string");
    assert.deepEqual(strategy.lastInput.memories, []);
  });

  it("sem promptTokens na strategy → 0; com valor → repassa", async () => {
    const conversation = new MemoryConversationStore();
    const without = await runChat(
      { message: "a" },
      { conversation, ...graphFor(createFakeStrategy()) },
    );
    assert.equal(without.metrics.promptTokens, 0);

    const withTokens = await runChat(
      { message: "b" },
      { conversation, ...graphFor(createFakeStrategy({ promptTokens: 42 })) },
    );
    assert.equal(withTokens.metrics.promptTokens, 42);
  });

  it("contextBreakdown reflete mensagem, histórico e memórias", async () => {
    const conversation = new MemoryConversationStore();
    const memory = new InMemoryMemoryStore();
    const fact = "prefiro alertas em português";
    memory.seedRecall("alice", [fact]);
    const strategy = createFakeStrategy();

    const first = await runChat(
      { message: "primeiro turn", userId: "alice" },
      {
        conversation,
        ...graphFor(strategy),
        memory,
        baseTools: [],
        learning: {
          distill: async () => ({ hasLearning: false, fact: "" }),
        },
      },
    );

    assert.deepEqual(
      first.metrics.contextBreakdown,
      estimateContextBreakdown({
        message: "primeiro turn",
        history: [],
        memories: [fact],
      }),
    );

    const second = await runChat(
      {
        message: "segundo",
        conversationId: first.conversationId,
        userId: "alice",
      },
      {
        conversation,
        ...graphFor(strategy),
        memory,
        baseTools: [],
        learning: {
          distill: async () => ({ hasLearning: false, fact: "" }),
        },
      },
    );

    assert.ok(strategy.lastInput && typeof strategy.lastInput !== "string");
    assert.deepEqual(
      second.metrics.contextBreakdown,
      estimateContextBreakdown({
        message: "segundo",
        history: strategy.lastInput.history ?? [],
        memories: [fact],
      }),
    );
    assert.equal(
      second.metrics.contextBreakdown?.message,
      estimateTokens("segundo"),
    );
  });

  it("com userId + preferência: agenda remember", async () => {
    const conversation = new MemoryConversationStore();
    const memory = new InMemoryMemoryStore();
    const strategy = createFakeStrategy();
    const remembered: string[] = [];
    const tasks: Array<() => Promise<void>> = [];

    memory.remember = async (_userId, fact) => {
      remembered.push(fact);
      return "id-1";
    };

    await runChat(
      { message: "prefiro alertas em português", userId: "alice" },
      {
        conversation,
        ...graphFor(strategy),
        memory,
        baseTools: [],
        learning: {
          distill: async () => ({
            hasLearning: true,
            fact: "Prefere alertas em português",
          }),
          schedule: (fn) => {
            tasks.push(fn);
          },
        },
      },
    );

    assert.equal(tasks.length, 1);
    await tasks[0]?.();
    assert.deepEqual(remembered, ["Prefere alertas em português"]);
  });

  it("sem userId: não agenda aprendizado", async () => {
    const conversation = new MemoryConversationStore();
    const memory = new InMemoryMemoryStore();
    const strategy = createFakeStrategy();
    let scheduled = 0;

    await runChat(
      { message: "prefiro PT" },
      {
        conversation,
        ...graphFor(strategy),
        memory,
        learning: {
          distill: async () => ({
            hasLearning: true,
            fact: "Prefere PT",
          }),
          schedule: () => {
            scheduled += 1;
          },
        },
      },
    );

    assert.equal(scheduled, 0);
  });

  it("remember deferred: runChat retorna antes do settle", async () => {
    const conversation = new MemoryConversationStore();
    const memory = new InMemoryMemoryStore();
    const strategy = createFakeStrategy();
    const remembered: string[] = [];
    const tasks: Array<() => Promise<void>> = [];

    memory.remember = async (_userId, fact) => {
      remembered.push(fact);
      return "id-1";
    };

    const result = await runChat(
      { message: "prefiro PT", userId: "alice" },
      {
        conversation,
        ...graphFor(strategy),
        memory,
        baseTools: [],
        learning: {
          distill: async () => ({
            hasLearning: true,
            fact: "Prefere PT",
          }),
          schedule: (fn) => {
            tasks.push(fn);
          },
        },
      },
    );

    assert.equal(result.answer, "eco:prefiro PT");
    assert.equal(remembered.length, 0);
    assert.equal(tasks.length, 1);
    await tasks[0]?.();
    assert.deepEqual(remembered, ["Prefere PT"]);
  });

  it("distill que lança: runChat ainda devolve answer", async () => {
    const conversation = new MemoryConversationStore();
    const memory = new InMemoryMemoryStore();
    const strategy = createFakeStrategy();
    let remembered = 0;
    memory.remember = async () => {
      remembered += 1;
      return "x";
    };

    const result = await runChat(
      { message: "prefiro PT", userId: "alice" },
      {
        conversation,
        ...graphFor(strategy),
        memory,
        baseTools: [],
        learning: {
          distill: async () => {
            throw new Error("modelo fora");
          },
          // schedule default engole; forçamos execução sync da task com catch
          schedule: (fn) => {
            void fn().catch(() => undefined);
          },
        },
      },
    );

    assert.equal(result.answer, "eco:prefiro PT");
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(remembered, 0);
  });

  it("com userId+memory: options.tools inclui forget_preference", async () => {
    const conversation = new MemoryConversationStore();
    const memory = new InMemoryMemoryStore();
    const strategy = createFakeStrategy();

    await runChat(
      { message: "oi", userId: "alice" },
      {
        conversation,
        ...graphFor(strategy),
        memory,
        baseTools: [],
        learning: {
          distill: async () => ({ hasLearning: false, fact: "" }),
        },
      },
    );

    const tools = strategy.lastOptions?.tools ?? [];
    const names = tools.map((t) => (t as { name?: string }).name);
    assert.ok(names.includes("forget_preference"));
  });

  it("sob teto padrão: lastInput e métricas batem com o orçado (único caminho)", async () => {
    const conversation = new MemoryConversationStore();
    const memory = new InMemoryMemoryStore();
    const fact = "prefiro alertas em português";
    memory.seedRecall("alice", [fact]);
    const strategy = createFakeStrategy();
    const id = conversation.create();
    conversation.upsertSummary(id, {
      text: "resumo curto",
      coveredThroughMessageId: 0,
    });
    conversation.append(id, { role: "user", content: "hist1" });
    conversation.append(id, { role: "assistant", content: "hist2" });

    const result = await runChat(
      { message: "agora", conversationId: id, userId: "alice" },
      {
        conversation,
        ...graphFor(strategy),
        memory,
        baseTools: [],
        learning: {
          distill: async () => ({ hasLearning: false, fact: "" }),
        },
      },
    );

    assert.ok(strategy.lastInput && typeof strategy.lastInput !== "string");
    assert.equal(strategy.lastInput.message, "agora");
    assert.equal(strategy.lastInput.summary, "resumo curto");
    assert.equal(strategy.lastInput.history?.length, 2);
    assert.deepEqual(strategy.lastInput.memories, [fact]);
    assert.equal(result.metrics.historyMessages, 2);
    assert.equal(result.metrics.recalledMemories, 1);
    assert.deepEqual(
      result.metrics.contextBreakdown,
      estimateContextBreakdown({
        message: "agora",
        history: strategy.lastInput.history ?? [],
        memories: strategy.lastInput.memories ?? [],
        summary: strategy.lastInput.summary,
      }),
    );
  });

  it("sectionBudgets baixos: corta history/memories/summary e métricas pós-corte", async () => {
    const conversation = new MemoryConversationStore();
    const memory = new InMemoryMemoryStore();
    // cada fato = 1 token ("aaaa"); scores caem com o índice no fake store
    memory.seedRecall("alice", ["aaaa", "bbbb", "cccc"]);
    const strategy = createFakeStrategy();
    const id = conversation.create();
    conversation.upsertSummary(id, {
      text: "x".repeat(40),
      coveredThroughMessageId: 0,
    });
    conversation.append(id, { role: "user", content: "aaaa" });
    conversation.append(id, { role: "assistant", content: "bbbb" });
    conversation.append(id, { role: "user", content: "cccc" });

    const result = await runChat(
      { message: "KEEP", conversationId: id, userId: "alice" },
      {
        conversation,
        ...graphFor(strategy),
        memory,
        baseTools: [],
        learning: {
          distill: async () => ({ hasLearning: false, fact: "" }),
        },
        sectionBudgets: { summary: 2, window: 1, memories: 1 },
      },
    );

    assert.ok(strategy.lastInput && typeof strategy.lastInput !== "string");
    assert.equal(strategy.lastInput.message, "KEEP");
    assert.deepEqual(strategy.lastInput.history, [
      { role: "user", content: "cccc" },
    ]);
    assert.deepEqual(strategy.lastInput.memories, ["aaaa"]);
    assert.ok(strategy.lastInput.summary);
    assert.ok(estimateTokens(strategy.lastInput.summary) <= 2);
    assert.equal(result.metrics.historyMessages, 1);
    assert.equal(result.metrics.recalledMemories, 1);
    assert.deepEqual(
      result.metrics.contextBreakdown,
      estimateContextBreakdown({
        message: "KEEP",
        history: strategy.lastInput.history ?? [],
        memories: strategy.lastInput.memories ?? [],
        summary: strategy.lastInput.summary,
      }),
    );
  });
});

describe("runChat fallbacks", () => {
  it("turn sem troca deixa fallbacks em 0 e sem evento", async () => {
    const conversation = new MemoryConversationStore();
    const result = await runChat(
      { message: "olá" },
      { conversation, ...graphFor(createFakeStrategy()) },
    );

    assert.equal(result.metrics.fallbacks, 0);
    assert.equal(
      result.trace.some((event) => event.type === "fallback"),
      false,
    );
  });

  it("anexa os eventos do coletor no fim do trace", async () => {
    const conversation = new MemoryConversationStore();
    const strategy: ReasoningStrategy = {
      name: "react",
      async run() {
        noteFallback("primary-model", "backup-a");
        noteFallback("primary-model", "backup-b");
        return {
          answer: "ok",
          trace: [{ type: "answer", content: "ok" }],
          metrics: { llmCalls: 1, latencyMs: 1 },
        };
      },
    };

    const result = await runChat(
      { message: "olá" },
      { conversation, ...graphFor(strategy) },
    );

    assert.equal(result.metrics.fallbacks, 2);
    assert.deepEqual(result.trace.slice(-2), [
      { type: "fallback", from: "primary-model", to: "backup-a" },
      { type: "fallback", from: "primary-model", to: "backup-b" },
    ]);
  });
});
