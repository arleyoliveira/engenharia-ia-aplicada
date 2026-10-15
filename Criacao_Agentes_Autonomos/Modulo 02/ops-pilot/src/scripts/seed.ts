/**
 * Seed do catálogo (data-model.md): 5 serviços, 6 alertas (3 firing,
 * 3 resolved) e 3 runbooks (checkout, payments, auth).
 * Idempotente por chave natural no SQLite operacional.
 */
import { toBoundaryMessage } from "../errors.js";
import { SqliteOpsStore } from "../store/sqlite-ops-store.js";

async function main(): Promise<void> {
  const store = new SqliteOpsStore();
  await store.seedMercado();
  const firing = await store.listAlerts({ status: "firing" });
  const resolved = await store.listAlerts({ status: "resolved" });
  const runbooks = await store.listRunbooks();
  console.log(
    `5 services, ${firing.length + resolved.length} alerts (${firing.length} firing, ${resolved.length} resolved), ${runbooks.length} runbooks.`,
  );
}

main().catch((error: unknown) => {
  const boundary = toBoundaryMessage(error);
  console.error(
    boundary ??
      `Erro inesperado no seed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
