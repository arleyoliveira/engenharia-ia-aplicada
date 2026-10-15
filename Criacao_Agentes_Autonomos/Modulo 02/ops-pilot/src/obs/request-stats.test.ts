import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateRequestStats,
  modelFromTrace,
  percentile,
  requestCost,
  routeFromTrace,
  sinceToMs,
} from "./request-stats.js";

describe("request stats", () => {
  it("aceita 24h, 30m, 7d e 60s e rejeita o resto", () => {
    assert.equal(sinceToMs("24h"), 24 * 3_600_000);
    assert.equal(sinceToMs(" 30m "), 30 * 60_000);
    assert.equal(sinceToMs("7d"), 7 * 86_400_000);
    assert.equal(sinceToMs("60s"), 60_000);
    assert.equal(sinceToMs("24H"), 24 * 3_600_000);
    assert.equal(sinceToMs("0h"), null);
    assert.equal(sinceToMs("ontem"), null);
    assert.equal(sinceToMs(""), null);
  });

  it("modelo :free custa 0", () => {
    assert.equal(requestCost("meta-llama/llama-3.2-3b-instruct:free", 50_000), 0);
    assert.equal(requestCost("openai/gpt-4o", 50_000), 0);
  });

  it("p50 e p95 usam o rank mais próximo para cima", () => {
    const values = [100, 200, 300, 400, 500];
    assert.equal(percentile(values, 50), 300);
    assert.equal(percentile(values, 95), 500);
    assert.equal(percentile([], 95), 0);
    assert.equal(percentile([42], 50), 42);
    assert.equal(percentile([42], 95), 42);
  });

  it("agrega total, erros, tokens, custo e quebra por rota e modelo", () => {
    const report = aggregateRequestStats(
      [
        { route: "react", model: "openai/gpt-4o-mini:free", status: "ok", promptTokens: 10, latencyMs: 100 },
        { route: "react", model: "openai/gpt-4o-mini:free", status: "error", promptTokens: 0, latencyMs: 400 },
        { route: "planExecute", model: "openai/gpt-4o", status: "ok", promptTokens: 30, latencyMs: 200 },
      ],
      "24h",
    );

    assert.equal(report.since, "24h");
    assert.equal(report.total, 3);
    assert.equal(report.errors, 1);
    assert.equal(report.tokens, 40);
    assert.equal(report.cost, 0);
    assert.deepEqual(report.latencyMs, { p50: 200, p95: 400 });
    assert.deepEqual(report.byRoute.map((item) => item.route), ["planExecute", "react"]);
    assert.equal(report.byRoute.find((item) => item.route === "react")?.errors, 1);
    assert.equal(report.byRoute.find((item) => item.route === "react")?.tokens, 10);
    assert.deepEqual(report.byModel.map((item) => item.model), [
      "openai/gpt-4o",
      "openai/gpt-4o-mini:free",
    ]);
    assert.equal(report.byModel[1]?.cost, 0);
    assert.equal(report.byModel[1]?.total, 2);
  });

  it("lê rota do trace e o modelo da reserva quando houve fallback", () => {
    assert.equal(
      routeFromTrace([
        { type: "route", route: "planExecute", reason: "override", override: true, node: "roteador" },
      ]),
      "planExecute",
    );
    assert.equal(
      modelFromTrace(
        [{ type: "fallback", from: "primario:free", to: "reserva:free" }],
        { OPENROUTER_MODEL: "primario:free" },
      ),
      "reserva:free",
    );
    assert.equal(modelFromTrace([], { OPENROUTER_MODEL: "primario:free" }), "primario:free");
  });
});
