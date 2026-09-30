import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { estimateTokens } from "../context/tokens.js";
import {
  createFakeHistorySummarizer,
  SUMMARIZER_PROMPT,
} from "./history-summarizer.js";

describe("history-summarizer fake", () => {
  it("exporta SUMMARIZER_PROMPT com invariantes do pedido", () => {
    assert.match(SUMMARIZER_PROMPT, /150 tokens/);
    assert.match(SUMMARIZER_PROMPT, /decisões tomadas/);
    assert.match(SUMMARIZER_PROMPT, /tópicos telegráficos/);
  });

  it("sem previous: ecoa batch e fica na faixa ~120..180 tokens", async () => {
    const summarizer = createFakeHistorySummarizer();
    const text = await summarizer.summarize({
      batch: [
        { role: "user", content: "abra incidente checkout" },
        { role: "assistant", content: "aberto #1" },
      ],
    });
    const tokens = estimateTokens(text);
    assert.ok(tokens >= 120 && tokens <= 180, `tokens=${tokens}`);
    assert.match(text, /BATCH:/);
    assert.match(text, /PREV:none/);
    assert.equal(summarizer.calls.length, 1);
  });

  it("com previous: indica mescla", async () => {
    const summarizer = createFakeHistorySummarizer();
    const text = await summarizer.summarize({
      previous: "resumo-anterior-xyz",
      batch: [{ role: "user", content: "ok" }],
    });
    assert.match(text, /PREV:resumo-anterior-xyz/);
  });

  it("ecoa eixos decisão/fato/pendência quando presentes", async () => {
    const summarizer = createFakeHistorySummarizer();
    const text = await summarizer.summarize({
      batch: [
        {
          role: "user",
          content: "decisão: priorizar; fato: prazo amanhã; pendência: validar",
        },
      ],
    });
    assert.match(text, /EIXOS:.*decisão/);
    assert.match(text, /fato/);
    assert.match(text, /pendência/);
  });
});
