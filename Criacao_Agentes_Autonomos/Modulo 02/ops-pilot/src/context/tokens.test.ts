import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  estimateContextBreakdown,
  estimateTokens,
  promptTokensFromLlmEnd,
} from "./tokens.js";

describe("estimateTokens", () => {
  it("retorna 0 para string vazia", () => {
    assert.equal(estimateTokens(""), 0);
  });

  it("retorna 0 para comprimento 1..3", () => {
    assert.equal(estimateTokens("a"), 0);
    assert.equal(estimateTokens("ab"), 0);
    assert.equal(estimateTokens("abc"), 0);
  });

  it("aplica floor no resto (5 → 1, 8 → 2)", () => {
    assert.equal(estimateTokens("abcde"), 1);
    assert.equal(estimateTokens("abcdefgh"), 2);
  });
});

describe("estimateContextBreakdown", () => {
  it("soma por fonte sem rótulos", () => {
    const breakdown = estimateContextBreakdown({
      message: "abcd", // 1
      history: [{ content: "abcdefgh" }, { content: "ab" }], // 2 + 0
      memories: ["abcd", "abcdefghij"], // 1 + 2
    });
    assert.deepEqual(breakdown, {
      message: 1,
      history: 2,
      memories: 3,
      summary: 0,
    });
  });

  it("fontes vazias → 0", () => {
    assert.deepEqual(
      estimateContextBreakdown({ message: "abcd", history: [], memories: [] }),
      { message: 1, history: 0, memories: 0, summary: 0 },
    );
  });

  it("summary vazio → 0; texto conhecido → floor(chars/4)", () => {
    assert.equal(
      estimateContextBreakdown({
        message: "abcd",
        history: [],
        memories: [],
        summary: "",
      }).summary,
      0,
    );
    assert.equal(
      estimateContextBreakdown({
        message: "abcd",
        history: [],
        memories: [],
        summary: "abcdefgh",
      }).summary,
      2,
    );
  });
});

describe("promptTokensFromLlmEnd", () => {
  it("usa llmOutput.tokenUsage.promptTokens", () => {
    assert.equal(
      promptTokensFromLlmEnd({
        llmOutput: { tokenUsage: { promptTokens: 40 } },
        generations: [
          [{ message: { usage_metadata: { input_tokens: 99 } } }],
        ],
      }),
      40,
    );
  });

  it("não duplica tokenUsage com usage_metadata", () => {
    assert.equal(
      promptTokensFromLlmEnd({
        llmOutput: { tokenUsage: { promptTokens: 10 } },
        generations: [
          [{ message: { usage_metadata: { input_tokens: 10 } } }],
        ],
      }),
      10,
    );
  });

  it("cai em usage_metadata.input_tokens da 1ª generation", () => {
    assert.equal(
      promptTokensFromLlmEnd({
        generations: [
          [{ message: { usage_metadata: { input_tokens: 28 } } }],
        ],
      }),
      28,
    );
  });

  it("cai em response_metadata.tokenUsage.promptTokens", () => {
    assert.equal(
      promptTokensFromLlmEnd({
        generations: [
          [
            {
              message: {
                response_metadata: { tokenUsage: { promptTokens: 15 } },
              },
            },
          ],
        ],
      }),
      15,
    );
  });

  it("ausência → 0; ignora estimatedTokenUsage", () => {
    assert.equal(promptTokensFromLlmEnd(undefined), 0);
    assert.equal(promptTokensFromLlmEnd({}), 0);
    assert.equal(
      promptTokensFromLlmEnd({
        llmOutput: { estimatedTokenUsage: { promptTokens: 999 } },
      }),
      0,
    );
  });

  it("número inválido/negativo → 0; não-inteiro finito → floor", () => {
    assert.equal(
      promptTokensFromLlmEnd({
        llmOutput: { tokenUsage: { promptTokens: -1 } },
      }),
      0,
    );
    assert.equal(
      promptTokensFromLlmEnd({
        llmOutput: { tokenUsage: { promptTokens: Number.NaN } },
      }),
      0,
    );
    assert.equal(
      promptTokensFromLlmEnd({
        llmOutput: { tokenUsage: { promptTokens: 7.9 } },
      }),
      7,
    );
  });
});

describe("conversa-longa.sh", () => {
  it("lê .metrics.promptTokens com fallback n/a", () => {
    const scriptPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../scripts/conversa-longa.sh",
    );
    const script = readFileSync(scriptPath, "utf8");
    assert.ok(script.includes(".metrics.promptTokens"));
    assert.ok(script.includes('"n/a"') || script.includes("'n/a'"));
    assert.ok(script.includes("promptTokens="));
  });
});
