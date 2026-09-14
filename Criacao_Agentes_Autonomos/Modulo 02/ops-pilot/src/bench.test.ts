/**
 * Testes determinísticos dos cenários de benchmark e verificadores de estado.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_SCENARIOS } from "./bench.js";
import type { StrategyResult } from "./agents/types.js";

describe("Benchmark Scenarios", () => {
  it("C1 setup e verificação de acerto", async () => {
    const scenario1 = ALL_SCENARIOS.find((s) => s.id === "C1")!;
    assert.ok(scenario1);

    const { store, repos } = await scenario1.setupStore();
    const alerts = await store.listAlerts({});
    assert.equal(alerts.length, 6);

    const dummyResult: StrategyResult = {
      answer: "Existem 3 alertas em estado firing no momento.",
      trace: [],
      metrics: { llmCalls: 2, latencyMs: 50 },
    };

    const verification = await scenario1.verify({ result: dummyResult, store, repos });
    assert.equal(verification.success, true);
  });

  it("C2 setup e verificação de acerto pelo estado do store", async () => {
    const scenario2 = ALL_SCENARIOS.find((s) => s.id === "C2")!;
    assert.ok(scenario2);

    const { store, repos } = await scenario2.setupStore();

    // Simula abertura dos 3 incidentes e resolução do primeiro
    const inc1 = await store.openIncident({
      title: "Erro 500",
      service: "checkout",
      severity: "medium",
    });
    await store.openIncident({
      title: "Timeout pagamentos",
      service: "payment",
      severity: "medium",
    });
    await store.openIncident({
      title: "Catálogo instável",
      service: "catalog",
      severity: "medium",
    });

    await store.resolveIncident({ id: inc1.id });

    const dummyResult: StrategyResult = {
      answer: "Incidentes abertos e o primeiro foi resolvido.",
      trace: [],
      metrics: { llmCalls: 5, latencyMs: 120 },
    };

    const verification = await scenario2.verify({ result: dummyResult, store, repos });
    assert.equal(verification.success, true);
    assert.ok(verification.details.includes("checkout, payment, catalog"));
  });

  it("C3 setup e verificação de acerto", async () => {
    const scenario3 = ALL_SCENARIOS.find((s) => s.id === "C3")!;
    assert.ok(scenario3);

    const { store, repos } = await scenario3.setupStore();

    // Abre incidente para o alerta mais antigo (api-gateway)
    await store.openIncident({
      title: "Latência p95",
      service: "api-gateway",
      severity: "high",
    });

    const dummyResult: StrategyResult = {
      answer: "Abri incidente para api-gateway e sobraram 2 alertas disparando.",
      trace: [],
      metrics: { llmCalls: 3, latencyMs: 80 },
    };

    const verification = await scenario3.verify({ result: dummyResult, store, repos });
    assert.equal(verification.success, true);
  });
});
