import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { estimateContextBreakdown, estimateTokens } from "./tokens.js";
import {
  DEFAULT_SECTION_BUDGETS,
  assemble,
  buildBudgetedContext,
  buildContext,
  resolveSectionBudgets,
  trimMemoriesLowestScoreFirst,
  trimSummaryToBudget,
  trimWindowOldestFirst,
} from "./context-builder.js";

describe("buildContext / assemble — breakdown por seção", () => {
  it("assemble devolve breakdown alinhado ao material orçado", () => {
    const built = assemble(
      {
        system: "sys",
        summary: "abcd",
        history: [{ role: "user", content: "abcdefgh" }],
        memories: ["abcd"],
      },
      "xxxx",
    );

    assert.equal(built.system, "sys");
    assert.equal(built.message, "xxxx");
    assert.deepEqual(
      built.breakdown,
      estimateContextBreakdown({
        message: "xxxx",
        history: [{ content: "abcdefgh" }],
        memories: ["abcd"],
        summary: "abcd",
      }),
    );
  });

  it("buildContext aplica fitToBudget e breakdown pós-corte", () => {
    const built = buildContext(
      {
        message: "msg!",
        summary: "x".repeat(40),
        history: [
          { role: "user", content: "aaaa" },
          { role: "assistant", content: "bbbb" },
          { role: "user", content: "cccc" },
        ],
        memories: [
          { fact: "aaaa", score: 0.9 },
          { fact: "bbbb", score: 0.2 },
        ],
      },
      { summary: 2, window: 1, memories: 1 },
    );

    assert.equal(built.message, "msg!");
    assert.deepEqual(built.history, [{ role: "user", content: "cccc" }]);
    assert.deepEqual(built.memories, ["aaaa"]);
    assert.ok(built.summary);
    assert.ok(estimateTokens(built.summary) <= 2);
    assert.deepEqual(
      built.breakdown,
      estimateContextBreakdown({
        message: built.message,
        history: built.history,
        memories: built.memories,
        summary: built.summary,
      }),
    );
  });
});

describe("resolveSectionBudgets", () => {
  it("usa defaults quando env vazio", () => {
    assert.deepEqual(resolveSectionBudgets({}), DEFAULT_SECTION_BUDGETS);
    assert.deepEqual(DEFAULT_SECTION_BUDGETS, {
      summary: 200,
      window: 1200,
      memories: 300,
    });
  });

  it("aceita valores baixos válidos", () => {
    assert.deepEqual(
      resolveSectionBudgets({
        CONTEXT_BUDGET_SUMMARY: "20",
        CONTEXT_BUDGET_WINDOW: "40",
        CONTEXT_BUDGET_MEMORIES: "25",
      }),
      { summary: 20, window: 40, memories: 25 },
    );
  });

  it("inválidos caem no padrão da seção", () => {
    assert.deepEqual(
      resolveSectionBudgets({
        CONTEXT_BUDGET_SUMMARY: "0",
        CONTEXT_BUDGET_WINDOW: "abc",
        CONTEXT_BUDGET_MEMORIES: "",
      }),
      DEFAULT_SECTION_BUDGETS,
    );
    assert.deepEqual(
      resolveSectionBudgets({
        CONTEXT_BUDGET_SUMMARY: "-5",
        CONTEXT_BUDGET_WINDOW: "  ",
        CONTEXT_BUDGET_MEMORIES: "1.5",
      }),
      DEFAULT_SECTION_BUDGETS,
    );
  });
});

describe("buildBudgetedContext — sob teto", () => {
  it("preserva system, message, summary, history e memories", () => {
    const built = buildBudgetedContext(
      {
        system: "sys-prompt",
        message: "olá plantão",
        summary: "decisão X",
        history: [
          { role: "user", content: "antes" },
          { role: "assistant", content: "depois" },
        ],
        memories: [
          { fact: "prefiro português", score: 0.9 },
          { fact: "canal slack", score: 0.8 },
        ],
      },
      DEFAULT_SECTION_BUDGETS,
    );

    assert.equal(built.system, "sys-prompt");
    assert.equal(built.message, "olá plantão");
    assert.equal(built.summary, "decisão X");
    assert.deepEqual(built.history, [
      { role: "user", content: "antes" },
      { role: "assistant", content: "depois" },
    ]);
    assert.deepEqual(built.memories, ["prefiro português", "canal slack"]);
  });

  it("system e message nunca alterados sob tetos baixos", () => {
    const longSystem = "S".repeat(400);
    const longMessage = "M".repeat(400);
    const built = buildBudgetedContext(
      {
        system: longSystem,
        message: longMessage,
        summary: "a".repeat(200),
        history: [
          { role: "user", content: "old-".repeat(20) },
          { role: "assistant", content: "new-".repeat(20) },
        ],
        memories: [
          { fact: "low-".repeat(20), score: 0.1 },
          { fact: "high-".repeat(20), score: 0.9 },
        ],
      },
      { summary: 5, window: 5, memories: 5 },
    );

    assert.equal(built.system, longSystem);
    assert.equal(built.message, longMessage);
  });
});

describe("trim / fitToBudget — ordem de corte", () => {
  it("janela: remove mais antigas; sobra a mais recente", () => {
    const old = { role: "user" as const, content: "aaaa" }; // 1 token
    const mid = { role: "assistant" as const, content: "bbbb" }; // 1
    const neu = { role: "user" as const, content: "cccc" }; // 1
    const history = trimWindowOldestFirst([old, mid, neu], 1);
    assert.deepEqual(history, [neu]);

    const built = buildBudgetedContext(
      {
        system: "sys",
        message: "msg",
        history: [old, mid, neu],
        memories: [],
      },
      { summary: 200, window: 1, memories: 300 },
    );
    assert.equal(built.system, "sys");
    assert.equal(built.message, "msg");
    assert.deepEqual(built.history, [neu]);
  });

  it("memórias: remove menor score; empate remove pior ranking", () => {
    const facts = [
      { fact: "aaaa", score: 0.9 }, // 1
      { fact: "bbbb", score: 0.5 }, // 1
      { fact: "cccc", score: 0.2 }, // 1
    ];
    assert.deepEqual(trimMemoriesLowestScoreFirst(facts, 2), ["aaaa", "bbbb"]);

    const tied = [
      { fact: "aaaa", score: 0.5 },
      { fact: "bbbb", score: 0.5 },
      { fact: "cccc", score: 0.9 },
    ];
    // teto 2: remove um dos 0.5 — o de pior ranking (bbbb, índice 1)
    assert.deepEqual(trimMemoriesLowestScoreFirst(tied, 2), ["aaaa", "cccc"]);
  });

  it("resumo: prefixo com estimateTokens ≤ teto", () => {
    const long = "x".repeat(100); // 25 tokens
    const trimmed = trimSummaryToBudget(long, 5);
    assert.ok(trimmed);
    assert.ok(estimateTokens(trimmed) <= 5);
    assert.equal(trimmed, long.slice(0, trimmed.length));

    const built = buildBudgetedContext(
      {
        system: "sys",
        message: "msg",
        summary: long,
        history: [],
        memories: [],
      },
      { summary: 5, window: 1200, memories: 300 },
    );
    assert.equal(built.system, "sys");
    assert.equal(built.message, "msg");
    assert.ok(built.summary);
    assert.ok(estimateTokens(built.summary) <= 5);
  });

  it("item individual > teto não entra; cortes multi-seção independentes", () => {
    const huge = "h".repeat(40); // 10 tokens
    const small = "abcd"; // 1
    const built = buildBudgetedContext(
      {
        message: "KEEP_MSG",
        system: "KEEP_SYS",
        summary: "s".repeat(40),
        history: [
          { role: "user", content: huge },
          { role: "assistant", content: small },
        ],
        memories: [
          { fact: huge, score: 0.99 },
          { fact: small, score: 0.1 },
        ],
      },
      { summary: 2, window: 2, memories: 2 },
    );

    assert.equal(built.message, "KEEP_MSG");
    assert.equal(built.system, "KEEP_SYS");
    assert.deepEqual(built.history, [{ role: "assistant", content: small }]);
    assert.deepEqual(built.memories, [small]);
    assert.ok(built.summary);
    assert.ok(estimateTokens(built.summary) <= 2);
  });
});
