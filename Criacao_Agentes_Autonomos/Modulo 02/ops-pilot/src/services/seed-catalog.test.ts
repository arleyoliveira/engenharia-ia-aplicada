import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readSeedCatalogFile, buildSeedCatalog } from "./seed-catalog.js";
import { createMemoryRepos } from "./alert-store.memory.js";
import { createAlertStore } from "./alert-store.js";

describe("seed catalog fallback", () => {
  it("carrega o catálogo do arquivo JSON de sementes", async () => {
    const catalog = await readSeedCatalogFile();
    assert.equal(catalog.services.length, 5);
    assert.equal(catalog.alerts.length, 6);
    assert.equal(catalog.alerts.filter((item) => item.status === "firing").length, 3);
  });

  it("aplica o catálogo em memória sem depender do banco", async () => {
    const store = createAlertStore(createMemoryRepos());
    const catalog = await readSeedCatalogFile();
    await buildSeedCatalog(store, catalog);

    const firing = await store.listAlerts({ status: "firing" });
    const resolved = await store.listAlerts({ status: "resolved" });

    assert.equal(firing.length, 3);
    assert.equal(resolved.length, 3);
  });
});
