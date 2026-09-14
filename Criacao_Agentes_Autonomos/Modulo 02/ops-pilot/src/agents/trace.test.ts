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
});

describe("summarizeMetrics", () => {
  it("formata métricas com campos llmCalls e latencyMs", () => {
    assert.equal(
      summarizeMetrics({ llmCalls: 4, latencyMs: 3210 }),
      "llmCalls=4 latencyMs=3210",
    );
  });
});
