import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLlmCallCounter } from "./metrics.js";

describe("createLlmCallCounter", () => {
  it("handleLLMStart incrementa calls sem alterar promptTokens", async () => {
    const counter = createLlmCallCounter();
    await counter.handler.handleLLMStart?.(
      {} as never,
      [],
      "run-1",
    );
    assert.equal(counter.calls, 1);
    assert.equal(counter.promptTokens, 0);
  });

  it("duas handleLLMEnd somam promptTokens", async () => {
    const counter = createLlmCallCounter();
    await counter.handler.handleLLMEnd?.(
      {
        llmOutput: { tokenUsage: { promptTokens: 10 } },
        generations: [],
      } as never,
      "run-1",
    );
    await counter.handler.handleLLMEnd?.(
      {
        generations: [
          [{ message: { usage_metadata: { input_tokens: 25 } } }],
        ],
      } as never,
      "run-2",
    );
    assert.equal(counter.promptTokens, 35);
  });
});
