/**
 * Store padrão usado pelas ferramentas do agente: SQLite embarcado (SqliteOpsStore)
 * com caminho em OPSPILOT_DB (default: ./data/opspilot.db).
 * Mantém o mock in-memory para testes e para o bench para garantir cenários reproduzíveis.
 *
 * Atenção de nomes:
 * - `buildMemoryStore()` → AlertStore in-memory legado (não é memória semântica).
 * - `getDefaultMemoryStore()` → MemoryStore semântico (tabela `memories` + embeddings).
 */
import { SqliteOpsStore } from "../store/sqlite-ops-store.js";
import type { OpsStore } from "../store/ops-store.js";
import type { ConversationStore } from "../store/conversation-store.js";
import { SqliteConversationStore } from "../store/sqlite-conversation-store.js";
import {
  SqliteRequestTraceStore,
  type RequestTraceStore,
} from "../store/request-trace-store.js";
import {
  SqliteMemoryStore,
  type MemoryStore,
} from "../memory-store.js";
import { createAlertStore, type AlertStore } from "./alert-store.js";
import { createMemoryRepos } from "./alert-store.memory.js";
import { buildSeedCatalog, readSeedCatalogFile } from "./seed-catalog.js";

let cached: Promise<OpsStore> | null = null;
let cachedConversation: Promise<ConversationStore> | null = null;
let cachedMemory: Promise<MemoryStore> | null = null;
let cachedRequestTrace: Promise<RequestTraceStore> | null = null;

/** AlertStore in-memory legado (bench/testes). Não confundir com MemoryStore semântico. */
export async function buildMemoryStore(): Promise<AlertStore> {
  const store = createAlertStore(createMemoryRepos());
  const catalog = await readSeedCatalogFile();
  await buildSeedCatalog(store, catalog);
  return store;
}

export function getDefaultOpsStore(path?: string): Promise<OpsStore> {
  if (path) {
    const store = new SqliteOpsStore(path);
    return store.seedMercado().then(() => store);
  }

  if (!cached) {
    cached = (async () => {
      const store = new SqliteOpsStore();
      await store.seedMercado();
      return store;
    })();
  }
  return cached;
}

/** ConversationStore sobre o mesmo DatabaseSync do ops store padrão. */
export async function getDefaultConversationStore(
  path?: string,
): Promise<ConversationStore> {
  if (path) {
    const ops = (await getDefaultOpsStore(path)) as SqliteOpsStore;
    return new SqliteConversationStore(ops.db);
  }

  if (!cachedConversation) {
    cachedConversation = (async () => {
      const ops = (await getDefaultOpsStore()) as SqliteOpsStore;
      return new SqliteConversationStore(ops.db);
    })();
  }
  return cachedConversation;
}

/** MemoryStore semântico (tabela memories) sobre o mesmo DatabaseSync do ops store. */
export async function getDefaultMemoryStore(
  path?: string,
): Promise<MemoryStore> {
  if (path) {
    const ops = (await getDefaultOpsStore(path)) as SqliteOpsStore;
    return new SqliteMemoryStore(ops.db);
  }

  if (!cachedMemory) {
    cachedMemory = (async () => {
      const ops = (await getDefaultOpsStore()) as SqliteOpsStore;
      return new SqliteMemoryStore(ops.db);
    })();
  }
  return cachedMemory;
}

/** RequestTraceStore sobre o mesmo DatabaseSync do ops store padrão. */
export async function getDefaultRequestTraceStore(
  path?: string,
): Promise<RequestTraceStore> {
  if (path) {
    const ops = (await getDefaultOpsStore(path)) as SqliteOpsStore;
    return new SqliteRequestTraceStore(ops.db);
  }

  if (!cachedRequestTrace) {
    cachedRequestTrace = (async () => {
      const ops = (await getDefaultOpsStore()) as SqliteOpsStore;
      return new SqliteRequestTraceStore(ops.db);
    })();
  }
  return cachedRequestTrace;
}

export function getDefaultAlertStore(): Promise<AlertStore | OpsStore> {
  return getDefaultOpsStore();
}

export function resetDefaultStore(): void {
  cached = null;
  cachedConversation = null;
  cachedMemory = null;
  cachedRequestTrace = null;
}
