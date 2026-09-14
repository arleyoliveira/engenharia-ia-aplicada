/**
 * Store padrão usado pelas ferramentas do agente: MySQL quando DATABASE_URL
 * está configurado, ou catálogo em memória (seed-catalog.json) quando
 * ausente. Cacheado por processo para manter estado entre chamadas.
 */
import { ConfigError } from "../errors.js";
import { getSequelize } from "../models/database.js";
import { createSequelizeRepos } from "../models/repositories.js";
import { createAlertStore, type AlertStore } from "./alert-store.js";
import { createMemoryRepos } from "./alert-store.memory.js";
import { buildSeedCatalog, readSeedCatalogFile } from "./seed-catalog.js";

let cached: Promise<AlertStore> | null = null;

async function buildMemoryStore(): Promise<AlertStore> {
  const store = createAlertStore(createMemoryRepos());
  const catalog = await readSeedCatalogFile();
  await buildSeedCatalog(store, catalog);
  return store;
}

export function getDefaultAlertStore(): Promise<AlertStore> {
  if (!cached) {
    cached = (async () => {
      try {
        getSequelize();
        return createAlertStore(createSequelizeRepos());
      } catch (error) {
        if (error instanceof ConfigError) {
          return buildMemoryStore();
        }
        throw error;
      }
    })();
  }
  return cached;
}
