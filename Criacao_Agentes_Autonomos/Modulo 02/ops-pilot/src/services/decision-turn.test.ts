import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decisionTurn } from "./decision-turn.js";

describe("decisionTurn", () => {
  it("devolve Aprovado ou Negado sem chamada de modelo", () => {
    assert.deepEqual(decisionTurn("approve"), {
      answer: "Aprovado.",
      userLine: "Aprovar",
      trace: [{ type: "answer", content: "Aprovado.", node: "decisao" }],
      metrics: { llmCalls: 0, latencyMs: 0 },
    });
    const denied = decisionTurn("deny");
    assert.equal(denied.answer, "Negado.");
    assert.equal(denied.trace[0]?.type, "answer");
    if (denied.trace[0]?.type === "answer") {
      assert.equal(denied.trace[0].content, "Negado.");
    }
    assert.equal(denied.userLine, "Negar");
  });
});
