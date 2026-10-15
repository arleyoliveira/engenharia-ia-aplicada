/**
 * Catálogo semeado em JSON para execução local e testes determinísticos.
 * Mantém a mesma fonte de verdade do seed do MySQL quando o banco não está
 * configurado ou em ambientes sem infraestrutura.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AlertStore, SeedCatalog } from "./alert-store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, "../data/seed-catalog.json");

export async function readSeedCatalogFile(): Promise<SeedCatalog> {
  const raw = await readFile(seedPath, "utf8");
  return JSON.parse(raw) as SeedCatalog;
}

export async function buildSeedCatalog(
  store: AlertStore,
  catalog: SeedCatalog,
): Promise<void> {
  for (const name of catalog.services) {
    await store.ensureService(name);
  }
  for (const alert of catalog.alerts) {
    await store.ensureAlert(alert);
  }
}
