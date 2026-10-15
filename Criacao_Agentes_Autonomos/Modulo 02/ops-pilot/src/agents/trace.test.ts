/**
 * Testes determinísticos de formatação de traces (T007).
 * Sem rede: constroem traces artificiais e validam a serialização estável.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatTrace, summarizeMetrics } from "./trace.js";
import type { TraceEvent } from "./types.js";

describe("formatTrace", () => {
  it("serializa um evento por linha com tipo entre colchetes", () => {
    const trace: TraceEvent[] = [
      { type: "thought", content: "Preciso listar os alertas" },
      { type: "action", tool: "list_alerts", args: { status: "firing" } },
      { type: "observation", content: '{"alerts":[]}' },
      { type: "answer", content: "Nenhum alerta disparando." },
    ];
    const output = formatTrace(trace);
    const lines = output.split("\n");
    assert.equal(lines.length, 4);
    assert.equal(lines[0], "[thought] Preciso listar os alertas");
    assert.equal(
      lines[1],
      '[action] list_alerts({"status":"firing"})',
    );
    assert.equal(lines[2], '[observation] {"alerts":[]}');
    assert.equal(lines[3], "[answer] Nenhum alerta disparando.");
  });

  it("evento handoff mostra o papel e o recado", () => {
    const trace: TraceEvent[] = [
      { type: "handoff", from: "supervisor", to: "analista", brief: "ler alertas", node: "supervisor" },
      { type: "answer", content: "feito" },
    ];
    const lines = formatTrace(trace).split("\n");
    assert.equal(lines[0], "[handoff] analista ler alertas");
    assert.equal(lines[1], "[answer] feito");
  });

  it("evento plan lista passos numerados", () => {
    const trace: TraceEvent[] = [
      { type: "plan", steps: ["Listar firing", "Abrir incidente"] },
      { type: "answer", content: "feito" },
    ];
    const lines = formatTrace(trace).split("\n");
    assert.equal(lines[0], "[plan] 1. Listar firing | 2. Abrir incidente");
  });

  it("evento action serializa args como JSON estável", () => {
    const trace: TraceEvent[] = [
      { type: "action", tool: "open_incident", args: { title: "T", service: "billing", severity: "high" } },
    ];
    assert.equal(
      formatTrace(trace),
      '[action] open_incident({"title":"T","service":"billing","severity":"high"})',
    );
  });

  it("saída é determinística para o mesmo trace", () => {
    const trace: TraceEvent[] = [
      { type: "thought", content: "x" },
      { type: "critique", content: "y" },
      { type: "answer", content: "z" },
    ];
    assert.equal(formatTrace(trace), formatTrace(trace));
    assert.equal(
      formatTrace(trace),
      "[thought] x\n[critique] y\n[answer] z",
    );
  });

  it("evento critique serializa como [critique] conteúdo", () => {
    const trace: TraceEvent[] = [
      { type: "critique", content: "Replanner encerrou: objetivo cumprido." },
    ];
    assert.equal(
      formatTrace(trace),
      "[critique] Replanner encerrou: objetivo cumprido.",
    );
  });

  it("evento plan de encerramento por limite registra o motivo", () => {
    const trace: TraceEvent[] = [
      { type: "plan", steps: ["Listar firing"] },
      { type: "critique", content: "Limite de iterações (1) atingido." },
      { type: "answer", content: "Execução interrompida: limite de iterações (1) atingido." },
    ];
    const output = formatTrace(trace);
    assert.ok(output.includes("[plan] 1. Listar firing"));
    assert.ok(output.includes("[critique] Limite de iterações (1) atingido."));
    assert.ok(output.endsWith("[answer] Execução interrompida: limite de iterações (1) atingido."));
  });

  it("serializa eventos de reflexão com pareceres do crítico", () => {
    const trace: TraceEvent[] = [
      { type: "action", tool: "list_alerts", args: {} },
      { type: "observation", content: '{"alerts":[]}' },
      { type: "critique", content: "[REPROVADO] Faltou abrir o incidente." },
      { type: "action", tool: "open_incident", args: { service: "billing" } },
      { type: "observation", content: '{"incident":{"id":1}}' },
      { type: "critique", content: "[APROVADO] Tudo correto." },
      { type: "answer", content: "Finalizado." },
    ];
    const output = formatTrace(trace);
    assert.ok(output.includes("[critique] [REPROVADO] Faltou abrir o incidente."));
    assert.ok(output.includes("[critique] [APROVADO] Tudo correto."));
    assert.ok(output.includes("[answer] Finalizado."));
  });

  it("evento summarize serializa como [summarize] conteúdo", () => {
    const trace: TraceEvent[] = [
      { type: "summarize", content: "Decisões: priorizar checkout" },
      { type: "answer", content: "ok" },
    ];
    assert.equal(
      formatTrace(trace),
      "[summarize] Decisões: priorizar checkout\n[answer] ok",
    );
  });

  it("evento route serializa rota, override e motivo sem o nó", () => {
    const trace: TraceEvent[] = [
      {
        type: "route",
        route: "planExecute",
        reason: "estratégia informada pelo cliente",
        override: true,
        node: "roteador",
      },
      { type: "thought", content: "Preciso listar os alertas" },
      { type: "answer", content: "feito" },
    ];
    const lines = formatTrace(trace).split("\n");
    assert.equal(
      lines[0],
      "[route] planExecute override=true estratégia informada pelo cliente",
    );
    assert.equal(lines[1], "[thought] Preciso listar os alertas");
    assert.equal(lines[2], "[answer] feito");
  });
});

describe("summarizeMetrics", () => {
  it("formata métricas com campos llmCalls e latencyMs", () => {
    assert.equal(
      summarizeMetrics({ llmCalls: 4, latencyMs: 3210 }),
      "llmCalls=4 latencyMs=3210",
    );
  });

  it("inclui promptTokens quando definido", () => {
    assert.equal(
      summarizeMetrics({ llmCalls: 2, latencyMs: 100, promptTokens: 840 }),
      "llmCalls=2 latencyMs=100 promptTokens=840",
    );
  });

  it("inclui fallbacks quando definido", () => {
    assert.equal(
      summarizeMetrics({ llmCalls: 2, latencyMs: 100, fallbacks: 1 }),
      "llmCalls=2 latencyMs=100 fallbacks=1",
    );
  });
});

describe("formatTrace fallback", () => {
  it("imprime from e to sem content", () => {
    assert.equal(
      formatTrace([
        { type: "fallback", from: "openai/gpt-4o-mini", to: "openai/gpt-4.1-mini" },
      ]),
      "[fallback] openai/gpt-4o-mini → openai/gpt-4.1-mini",
    );
  });
});
