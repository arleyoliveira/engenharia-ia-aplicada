import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeChatPrompt } from "./compose-chat-prompt.js";

describe("composeChatPrompt memories", () => {
  it("inclui bloco Memórias relevantes quando há fatos", () => {
    const prompt = composeChatPrompt({
      message: "oi",
      memories: ["prefiro alertas em português"],
    });

    assert.match(prompt, /Memórias relevantes:/);
    assert.match(prompt, /- prefiro alertas em português/);
    assert.match(prompt, /oi$/);
  });

  it("omite bloco quando memories vazio/ausente", () => {
    assert.equal(composeChatPrompt({ message: "só isso" }), "só isso");
    assert.equal(
      composeChatPrompt({ message: "só isso", memories: [] }),
      "só isso",
    );
  });

  it("combina memórias + histórico", () => {
    const prompt = composeChatPrompt({
      message: "e agora?",
      history: [{ role: "user", content: "antes" }],
      memories: ["fato"],
    });

    assert.match(prompt, /Memórias relevantes:\n- fato/);
    assert.match(prompt, /Histórico da conversa:/);
    assert.match(prompt, /Mensagem atual:\ne agora\?/);
  });

  it("inclui Resumo da conversa quando summary presente", () => {
    const prompt = composeChatPrompt({
      message: "oi",
      summary: "Decisão: priorizar checkout",
    });
    assert.match(prompt, /Resumo da conversa:/);
    assert.match(prompt, /Decisão: priorizar checkout/);
    assert.match(prompt, /oi$/);
  });

  it("omite resumo quando summary vazio/ausente", () => {
    assert.equal(composeChatPrompt({ message: "só" }), "só");
    assert.equal(
      composeChatPrompt({ message: "só", summary: "   " }),
      "só",
    );
  });

  it("resumo antes de memórias e histórico", () => {
    const prompt = composeChatPrompt({
      message: "agora",
      summary: "resumo-x",
      memories: ["fato-y"],
      history: [{ role: "user", content: "antes" }],
    });
    const summaryAt = prompt.indexOf("Resumo da conversa:");
    const memAt = prompt.indexOf("Memórias relevantes:");
    const histAt = prompt.indexOf("Histórico da conversa:");
    assert.ok(summaryAt >= 0 && memAt > summaryAt && histAt > memAt);
  });
});
