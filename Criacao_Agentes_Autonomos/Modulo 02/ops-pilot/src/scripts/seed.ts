/**
 * Seed do catálogo (data-model.md): 5 serviços, 6 alertas (3 firing,
 * 3 resolved). Idempotente por chave natural. Em execução local sem banco,
 * usa o catálogo em JSON para manter a execução e os testes determinísticos.
 */
import { closeSequelize, getSequelize } from "../models/database.js";
import { createSequelizeRepos } from "../models/repositories.js";
import { toBoundaryMessage } from "../errors.js";
import { createAlertStore } from "../services/alert-store.js";
import { createMemoryRepos } from "../services/alert-store.memory.js";
import { buildSeedCatalog, readSeedCatalogFile } from "../services/seed-catalog.js";

async function printCounts(
  store: ReturnType<typeof createAlertStore>,
  serviceCount: number,
): Promise<void> {
  const firing = await store.listAlerts({ status: "firing" });
  const resolved = await store.listAlerts({ status: "resolved" });
  console.log(
    `${serviceCount} services, ${firing.length + resolved.length} alerts (${firing.length} firing, ${resolved.length} resolved)`,
  );
}

async function main(): Promise<void> {
  const catalog = await readSeedCatalogFile();
  try {
    const sequelize = getSequelize();
    const store = createAlertStore(createSequelizeRepos());
    await sequelize.sync();
    await buildSeedCatalog(store, catalog);
    await printCounts(store, catalog.services.length);
    return;
  } catch (error) {
    const boundary = toBoundaryMessage(error);
    if (boundary && /DATABASE_URL/.test(boundary)) {
      // Sem banco configurado: usa o catálogo JSON em memória (execução local/testes).
      const store = createAlertStore(createMemoryRepos());
      await buildSeedCatalog(store, catalog);
      await printCounts(store, catalog.services.length);
      return;
    }
    throw error;
  } finally {
    await closeSequelize();
  }
}

main()
  .catch((error: unknown) => {
    const boundary = toBoundaryMessage(error);
    console.error(
      boundary ??
        `Erro inesperado no seed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
