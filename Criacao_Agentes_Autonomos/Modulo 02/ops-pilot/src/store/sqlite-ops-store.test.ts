import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { ConfigError, NotFoundError } from "../errors.js";
import { seedCatalog } from "../services/alert-store.js";
import { SqliteOpsStore } from "./sqlite-ops-store.js";

const SERVICES = [
  "checkout",
  "payments",
  "catalog",
  "auth",
  "inventory",
] as const;

const ALERTS = [
  { service: "checkout", title: "Checkout latency above 2s", status: "firing" as const },
  { service: "payments", title: "Payment queue backlog", status: "firing" as const },
  { service: "catalog", title: "Catalog response errors", status: "firing" as const },
  { service: "auth", title: "Authentication stable", status: "resolved" as const },
  { service: "inventory", title: "Inventory index rebuilt", status: "resolved" as const },
  { service: "checkout", title: "Deploy completed safely", status: "resolved" as const },
];

describe("SqliteOpsStore", () => {
  it("seed cria 5 serviços, 6 alertas e runbooks idempotentes", async () => {
    const store = new SqliteOpsStore(":memory:");
    await seedCatalog(store as any, { services: [...SERVICES], alerts: ALERTS });
    await store.seedMercado();

    const firing = await store.listAlerts({ status: "firing" });
    const resolved = await store.listAlerts({ status: "resolved" });
    const runbooks = await store.listRunbooks();

    assert.equal(firing.length, 3);
    assert.equal(resolved.length, 3);
    assert.equal(runbooks.length, 3);

    await store.seedMercado();
    assert.equal((await store.listRunbooks()).length, 3);
  });

  it("abre e lista incidentes com status default open", async () => {
    const store = new SqliteOpsStore(":memory:");
    await seedCatalog(store as any, { services: [...SERVICES], alerts: ALERTS });
    await store.seedMercado();

    const first = await store.openIncident({ title: "Checkout degraded", service: "checkout", severity: "high" });
    const second = await store.openIncident({ title: "Payments retry storm", service: "payments", severity: "critical" });
    const resolved = await store.resolveIncident({ id: first.id });

    assert.equal(resolved.status, "resolved");
    assert.equal((await store.listIncidents()).length, 1);
    assert.equal((await store.listIncidents({ status: "resolved" })).length, 1);
    assert.equal((await store.listIncidents({ status: "all" })).length, 2);
  });

  it("consulta o runbook do serviço e rejeita ausência", async () => {
    const store = new SqliteOpsStore(":memory:");
    await store.seedMercado();

    const checkout = await store.getRunbook("checkout");
    assert.ok(checkout);
    assert.match(checkout!.steps, /checkout/i);

    await assert.rejects(
      () => store.getRunbook("missing-service"),
      (error: unknown) => error instanceof NotFoundError,
    );
  });

  it("persiste dados em arquivo e recupera estado após reinicialização", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "opspilot-test-"));
    const dbPath = join(tmpDir, "nested", "opspilot.db");

    try {
      // Cria instância 1 e abre incidente
      const store1 = new SqliteOpsStore(dbPath);
      await store1.seedMercado();

      const inc = await store1.openIncident({
        title: "Falha de pagamento persistente",
        service: "payments",
        severity: "critical",
      });
      assert.equal(inc.resolvedAt, null);
      assert.equal(inc.summary, null);

      // Cria instância 2 apontando para o mesmo arquivo
      const store2 = new SqliteOpsStore(dbPath);
      const openIncidents = await store2.listIncidents({ status: "open" });
      assert.equal(openIncidents.length, 1);
      assert.equal(openIncidents[0].title, "Falha de pagamento persistente");
      assert.equal(openIncidents[0].service, "payments");
      assert.equal(openIncidents[0].resolvedAt, null);

      // Idempotência de seed no mesmo arquivo
      await store2.seedMercado();
      const allIncidents = await store2.listIncidents({ status: "all" });
      assert.equal(allIncidents.length, 1);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("rejeita valores fora do domínio pelos CHECKs e validações", async () => {
    const store = new SqliteOpsStore(":memory:");
    await store.seedMercado();

    await assert.rejects(
      () => store.ensureService("bad-service", "invalid-tier" as any),
      (error: unknown) => error instanceof ConfigError,
    );

    await assert.rejects(
      () => store.openIncident({ title: "Bad", service: "checkout", severity: "invalid-sev" as any }),
      (error: unknown) => error instanceof ConfigError,
    );

    await assert.rejects(
      () => store.listIncidents({ status: "invalid-status" as any }),
      (error: unknown) => error instanceof ConfigError,
    );
  });
});
