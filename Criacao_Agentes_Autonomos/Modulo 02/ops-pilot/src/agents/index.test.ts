import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createStrategyRegistry } from "./index.js";
import type { ReasoningStrategy } from "./types.js";

const fakeStrategy: ReasoningStrategy = {
  name: "fake",
  async run() {
    return {
      answer: "ok",
      trace: [],
      metrics: { llmCalls: 0, latencyMs: 0 },
    };
  },
};

describe("StrategyRegistry", () => {
  it("resolve a estratégia base e lista seus nomes", () => {
    const registry = createStrategyRegistry({ fake: fakeStrategy });

    assert.equal(registry.resolve("fake", false), fakeStrategy);
    assert.deepEqual(registry.names(), ["fake"]);
    assert.equal(registry.resolve("missing", false), undefined);
  });

  it("aplica reflection à estratégia resolvida quando solicitado", () => {
    const registry = createStrategyRegistry({ fake: fakeStrategy });

    const reflected = registry.resolve("fake", true);

    assert.ok(reflected);
    assert.equal(reflected.name, "reflect:fake");
    assert.notEqual(reflected, fakeStrategy);
  });
});
