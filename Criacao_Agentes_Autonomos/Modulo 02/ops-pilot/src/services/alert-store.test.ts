/**
 * Testes determinísticos do store de alertas (T006).
 * Sem rede e sem banco real: o store recebe repositórios fake in-memory.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NotFoundError } from "../errors.js";
import {
  createAlertStore,
  seedCatalog,
  type AlertStore,
} from "./alert-store.js";
import {
  createMemoryRepos,
  type MemoryState,
} from "./alert-store.memory.js";

const SERVICES = [
  "api-gateway",
  "auth-service",
  "billing",
  "notifications",
  "search",
] as const;

const ALERTS: ReadonlyArray<{
  service: string;
  title: string;
  status: "firing" | "resolved";
}> = [
  { service: "api-gateway", title: "Latência p95 acima de 2s", status: "firing" },
  { service: "auth-service", title: "Taxa de erro 5xx > 5%", status: "firing" },
  { service: "billing", title: "Fila de pagamentos acumulando", status: "firing" },
  { service: "notifications", title: "Envio de e-mails normalizado", status: "resolved" },
  { service: "search", title: "Índice reconstruído", status: "resolved" },
  { service: "api-gateway", title: "Deploy concluído sem erros", status: "resolved" },
];

function makeStore(): { store: AlertStore; state: MemoryState } {
  const repos = createMemoryRepos();
  const store = createAlertStore(repos);
  return { store, state: repos.state };
}

async function makeSeededStore(): Promise<AlertStore> {
  const { store } = makeStore();
  await seedCatalog(store, { services: SERVICES, alerts: ALERTS });
  return store;
}

describe("alert-store", () => {
  it("seed cria 5 serviços e 6 alertas (3 firing, 3 resolved)", async () => {
    const store = await makeSeededStore();
    const firing = await store.listAlerts({ status: "firing" });
    const resolved = await store.listAlerts({ status: "resolved" });
    assert.equal(firing.length, 3);
    assert.equal(resolved.length, 3);
  });

  it("seed é idempotente: reexecutar não duplica o catálogo", async () => {
    const store = await makeSeededStore();
    await seedCatalog(store, { services: SERVICES, alerts: ALERTS });
    const firing = await store.listAlerts({ status: "firing" });
    const resolved = await store.listAlerts({ status: "resolved" });
    assert.equal(firing.length, 3);
    assert.equal(resolved.length, 3);
  });

  it("listAlerts sem filtro retorna todos os alertas", async () => {
    const store = await makeSeededStore();
    const all = await store.listAlerts({});
    assert.equal(all.length, 6);
  });

  it("listAlerts retorna o nome do serviço vinculado", async () => {
    const store = await makeSeededStore();
    const firing = await store.listAlerts({ status: "firing" });
    const services = firing.map((a) => a.service).sort();
    assert.deepEqual(services, ["api-gateway", "auth-service", "billing"]);
  });

  it("openIncident cria incidente aberto com id único", async () => {
    const store = await makeSeededStore();
    const incident = await store.openIncident({
      title: "Investigar latência",
      service: "api-gateway",
      severity: "high",
    });
    assert.ok(incident.id > 0);
    assert.equal(incident.status, "open");
    assert.equal(incident.service, "api-gateway");
    assert.equal(incident.severity, "high");
    assert.equal(incident.resolvedAt, null);
  });

  it("openIncident rejeita serviço inexistente com NotFoundError", async () => {
    const store = await makeSeededStore();
    await assert.rejects(
      () =>
        store.openIncident({
          title: "X",
          service: "nao-existe",
          severity: "low",
        }),
      (error: unknown) => error instanceof NotFoundError,
    );
  });

  it("resolveIncident marca como resolvido e registra resolvedAt", async () => {
    const store = await makeSeededStore();
    const incident = await store.openIncident({
      title: "Fila acumulando",
      service: "billing",
      severity: "critical",
    });
    const resolved = await store.resolveIncident({ id: incident.id });
    assert.equal(resolved.status, "resolved");
    assert.ok(resolved.resolvedAt instanceof Date);
  });

  it("resolveIncident é idempotente para incidente já resolvido", async () => {
    const store = await makeSeededStore();
    const incident = await store.openIncident({
      title: "Fila acumulando",
      service: "billing",
      severity: "high",
    });
    const first = await store.resolveIncident({ id: incident.id });
    const second = await store.resolveIncident({ id: incident.id });
    assert.equal(second.status, "resolved");
    assert.deepEqual(second.resolvedAt, first.resolvedAt);
  });

  it("resolveIncident lança NotFoundError para id inexistente", async () => {
    const store = await makeSeededStore();
    await assert.rejects(
      () => store.resolveIncident({ id: 9999 }),
      (error: unknown) => error instanceof NotFoundError,
    );
  });
});
