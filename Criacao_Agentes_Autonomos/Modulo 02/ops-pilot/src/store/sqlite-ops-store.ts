import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ConfigError, NotFoundError } from "../errors.js";
import type {
  AlertRecord,
  AlertStatus,
  IncidentFilter,
  IncidentRecord,
  OpsStore,
  RunbookRecord,
  ServiceRecord,
  Severity,
} from "./ops-store.js";

const DEFAULT_DB_PATH = "./data/opspilot.db";

const SERVICE_TIERS = ["critical", "high", "standard"] as const;
const ALERT_STATUSES = ["firing", "resolved"] as const;
const INCIDENT_STATUSES = ["open", "resolved"] as const;
const SEVERITIES = ["low", "medium", "high", "critical"] as const;

function isSqliteMemoryPath(path: string): boolean {
  return path === ":memory:";
}

function resolveDbPath(path?: string): string {
  const candidate = path ?? process.env.OPSPILOT_DB ?? DEFAULT_DB_PATH;
  if (!candidate.trim()) {
    throw new ConfigError("OPSPILOT_DB não pode estar vazio.");
  }
  return candidate;
}

function inferServiceTier(name: string): ServiceRecord["tier"] {
  const normalized = name.toLowerCase();
  if (normalized.includes("auth") || normalized.includes("payments")) {
    return "critical";
  }
  if (normalized.includes("checkout") || normalized.includes("catalog")) {
    return "high";
  }
  return "standard";
}

export class SqliteOpsStore implements OpsStore {
  readonly db: DatabaseSync;

  get _db(): DatabaseSync {
    return this.db;
  }

  constructor(path?: string) {
    const resolved = resolveDbPath(path);
    if (!isSqliteMemoryPath(resolved)) {
      const parent = dirname(resolved);
      if (parent && parent !== ".") {
        mkdirSync(parent, { recursive: true });
      }
    }

    this.db = new DatabaseSync(resolved);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        tier TEXT NOT NULL CHECK (tier IN ('critical', 'high', 'standard'))
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER NOT NULL,
        title TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('firing', 'resolved')),
        FOREIGN KEY (service_id) REFERENCES services(id)
      );

      CREATE TABLE IF NOT EXISTS incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        service_id INTEGER NOT NULL,
        severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at TEXT,
        summary TEXT,
        FOREIGN KEY (service_id) REFERENCES services(id)
      );

      CREATE TABLE IF NOT EXISTS runbooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER NOT NULL UNIQUE,
        name TEXT NOT NULL UNIQUE,
        steps TEXT NOT NULL,
        FOREIGN KEY (service_id) REFERENCES services(id)
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
        ON messages (conversation_id, id);

      CREATE TABLE IF NOT EXISTS conversation_summaries (
        conversation_id TEXT PRIMARY KEY,
        summary TEXT NOT NULL,
        covered_through_message_id INTEGER NOT NULL CHECK (covered_through_message_id >= 0),
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      );

      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        fact TEXT NOT NULL,
        embedding BLOB NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_memories_user_id
        ON memories (user_id);

      CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        metrics_json TEXT NOT NULL,
        route TEXT NOT NULL DEFAULT '',
        model TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'ok',
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        latency_ms INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_requests_created_at
        ON requests (created_at);

      CREATE TABLE IF NOT EXISTS trace_events (
        request_id TEXT NOT NULL,
        position INTEGER NOT NULL CHECK (position >= 0),
        node TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (request_id, position)
      );
    `);
    this.ensureRequestStatColumns();
  }

  /** Bancos já criados antes das colunas de agregação. */
  private ensureRequestStatColumns(): void {
    const columns = this.db.prepare("PRAGMA table_info(requests)").all() as Array<{ name: string }>;
    const names = new Set(columns.map((column) => column.name));
    const missing: Array<[string, string]> = [
      ["route", "TEXT NOT NULL DEFAULT ''"],
      ["model", "TEXT NOT NULL DEFAULT ''"],
      ["status", "TEXT NOT NULL DEFAULT 'ok'"],
      ["prompt_tokens", "INTEGER NOT NULL DEFAULT 0"],
      ["latency_ms", "INTEGER NOT NULL DEFAULT 0"],
    ];
    for (const [name, definition] of missing) {
      if (!names.has(name)) {
        this.db.exec(`ALTER TABLE requests ADD COLUMN ${name} ${definition}`);
      }
    }
  }

  private findServiceByName(name: string): ServiceRecord | null {
    const stmt = this.db.prepare("SELECT * FROM services WHERE name = ?");
    return (stmt.get(name) as ServiceRecord | undefined) ?? null;
  }

  private findAlertByTitle(title: string): AlertRecord | null {
    const stmt = this.db.prepare(
      "SELECT alerts.id, alerts.service_id AS serviceId, services.name AS service, alerts.title, alerts.status FROM alerts JOIN services ON alerts.service_id = services.id WHERE alerts.title = ?",
    );
    return (stmt.get(title) as AlertRecord | undefined) ?? null;
  }

  private findIncidentById(id: number): IncidentRecord | null {
    const stmt = this.db.prepare(
      "SELECT incidents.id, incidents.title, incidents.service_id AS serviceId, services.name AS service, incidents.severity, incidents.status, incidents.created_at AS createdAt, incidents.resolved_at AS resolvedAt, incidents.summary FROM incidents JOIN services ON incidents.service_id = services.id WHERE incidents.id = ?",
    );
    return (stmt.get(id) as IncidentRecord | undefined) ?? null;
  }

  async ensureService(
    name: string,
    tier?: "critical" | "high" | "standard",
  ): Promise<ServiceRecord> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new ConfigError("O nome do serviço não pode ser vazio.");
    }

    const existing = this.findServiceByName(trimmed);
    if (existing) {
      return existing;
    }

    const resolvedTier = tier ?? inferServiceTier(trimmed);
    if (!SERVICE_TIERS.includes(resolvedTier)) {
      throw new ConfigError(`tier inválido: ${resolvedTier}`);
    }

    const insert = this.db.prepare(
      "INSERT INTO services (name, tier) VALUES (?, ?)",
    );
    insert.run(trimmed, resolvedTier);

    const last = this.db.prepare("SELECT * FROM services WHERE id = last_insert_rowid()");
    const created = last.get() as ServiceRecord | undefined;
    if (!created) {
      throw new ConfigError("Falha ao criar o serviço no banco SQLite.");
    }
    return created;
  }

  async ensureAlert(input: {
    service: string;
    title: string;
    status: AlertStatus;
  }): Promise<AlertRecord> {
    const existing = this.findAlertByTitle(input.title);
    if (existing) {
      return existing;
    }

    const service = this.findServiceByName(input.service);
    if (!service) {
      throw new NotFoundError(`Serviço não encontrado: ${input.service}`);
    }

    if (!ALERT_STATUSES.includes(input.status)) {
      throw new ConfigError(`status inválido: ${input.status}`);
    }

    const insert = this.db.prepare(
      "INSERT INTO alerts (service_id, title, status) VALUES (?, ?, ?)",
    );
    insert.run(service.id, input.title, input.status);

    const created = this.findAlertByTitle(input.title);
    if (!created) {
      throw new ConfigError("Falha ao criar o alerta no banco SQLite.");
    }
    return created;
  }

  async listAlerts(filter?: { status?: AlertStatus }): Promise<AlertRecord[]> {
    const status = filter?.status;
    if (status && !ALERT_STATUSES.includes(status)) {
      throw new ConfigError(`status inválido: ${status}`);
    }

    if (status) {
      const stmt = this.db.prepare(
        "SELECT alerts.id, alerts.service_id AS serviceId, services.name AS service, alerts.title, alerts.status FROM alerts JOIN services ON alerts.service_id = services.id WHERE alerts.status = ? ORDER BY alerts.id ASC",
      );
      return stmt.all(status) as unknown as AlertRecord[];
    }

    const stmt = this.db.prepare(
      "SELECT alerts.id, alerts.service_id AS serviceId, services.name AS service, alerts.title, alerts.status FROM alerts JOIN services ON alerts.service_id = services.id ORDER BY alerts.id ASC",
    );
    return stmt.all() as unknown as AlertRecord[];
  }

  async openIncident(input: {
    title: string;
    service: string;
    severity: Severity;
  }): Promise<IncidentRecord> {
    const title = input.title.trim();
    if (!title) {
      throw new ConfigError("O título do incidente não pode ser vazio.");
    }

    if (!SEVERITIES.includes(input.severity)) {
      throw new ConfigError(`severity inválida: ${input.severity}`);
    }

    const service = this.findServiceByName(input.service.trim());
    if (!service) {
      throw new NotFoundError(`Serviço não encontrado: ${input.service}`);
    }

    const insert = this.db.prepare(
      "INSERT INTO incidents (title, service_id, severity, status, created_at, resolved_at, summary) VALUES (?, ?, ?, 'open', CURRENT_TIMESTAMP, NULL, NULL)",
    );
    insert.run(title, service.id, input.severity);

    const last = this.db.prepare("SELECT id FROM incidents WHERE id = last_insert_rowid()");
    const lastRow = last.get() as { id: number } | undefined;
    if (!lastRow) {
      throw new ConfigError("Falha ao abrir o incidente no banco SQLite.");
    }

    const created = this.findIncidentById(lastRow.id);
    if (!created) {
      throw new ConfigError("Falha ao carregar o incidente recém-aberto.");
    }
    return created;
  }

  async resolveIncident(input: { id: number }): Promise<IncidentRecord> {
    const incident = this.findIncidentById(input.id);
    if (!incident) {
      throw new NotFoundError(`Incidente não encontrado: ${input.id}`);
    }

    if (incident.status === "resolved") {
      return incident;
    }

    const stmt = this.db.prepare(
      "UPDATE incidents SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP WHERE id = ?",
    );
    stmt.run(input.id);

    const updated = this.findIncidentById(input.id);
    if (!updated) {
      throw new ConfigError("Falha ao resolver o incidente no banco SQLite.");
    }
    return updated;
  }

  async listIncidents(filter?: IncidentFilter): Promise<IncidentRecord[]> {
    const normalized =
      typeof filter === "string"
        ? filter
        : filter?.status ?? "open";

    if (normalized === "all") {
      const stmt = this.db.prepare(
        "SELECT incidents.id, incidents.title, incidents.service_id AS serviceId, services.name AS service, incidents.severity, incidents.status, incidents.created_at AS createdAt, incidents.resolved_at AS resolvedAt, incidents.summary FROM incidents JOIN services ON incidents.service_id = services.id ORDER BY incidents.created_at DESC, incidents.id DESC",
      );
      return stmt.all() as unknown as IncidentRecord[];
    }

    if (!INCIDENT_STATUSES.includes(normalized)) {
      throw new ConfigError(`status inválido: ${String(normalized)}`);
    }

    const stmt = this.db.prepare(
      "SELECT incidents.id, incidents.title, incidents.service_id AS serviceId, services.name AS service, incidents.severity, incidents.status, incidents.created_at AS createdAt, incidents.resolved_at AS resolvedAt, incidents.summary FROM incidents JOIN services ON incidents.service_id = services.id WHERE incidents.status = ? ORDER BY incidents.created_at DESC, incidents.id DESC",
    );
    return stmt.all(normalized) as unknown as IncidentRecord[];
  }

  async listRunbooks(): Promise<RunbookRecord[]> {
    const stmt = this.db.prepare(
      "SELECT runbooks.id, runbooks.service_id AS serviceId, services.name AS service, runbooks.name, runbooks.steps FROM runbooks JOIN services ON runbooks.service_id = services.id ORDER BY runbooks.id ASC",
    );
    return stmt.all() as unknown as RunbookRecord[];
  }

  async getRunbook(service: string): Promise<RunbookRecord> {
    const trimmed = service.trim();
    if (!trimmed) {
      throw new ConfigError("O nome do serviço não pode ser vazio ao consultar o runbook.");
    }

    const serviceRow = this.findServiceByName(trimmed);
    if (!serviceRow) {
      throw new NotFoundError(`Serviço não encontrado: ${trimmed}`);
    }

    const stmt = this.db.prepare(
      "SELECT runbooks.id, runbooks.service_id AS serviceId, services.name AS service, runbooks.name, runbooks.steps FROM runbooks JOIN services ON runbooks.service_id = services.id WHERE runbooks.service_id = ?",
    );
    const row = stmt.get(serviceRow.id) as RunbookRecord | undefined;
    if (!row) {
      throw new NotFoundError(`Runbook não encontrado para o serviço: ${trimmed}`);
    }
    return row;
  }

  async seedMercado(): Promise<void> {
    const services = [
      "checkout",
      "payments",
      "catalog",
      "auth",
      "inventory",
    ] as const;

    for (const serviceName of services) {
      await this.ensureService(serviceName);
    }

    const alerts: Array<{ service: string; title: string; status: AlertStatus }> = [
      { service: "checkout", title: "Checkout latency above 2s", status: "firing" },
      { service: "payments", title: "Payment queue backlog", status: "firing" },
      { service: "catalog", title: "Catalog response errors", status: "firing" },
      { service: "auth", title: "Authentication stable", status: "resolved" },
      { service: "inventory", title: "Inventory index rebuilt", status: "resolved" },
      { service: "checkout", title: "Deploy completed safely", status: "resolved" },
    ];

    for (const alert of alerts) {
      await this.ensureAlert(alert);
    }

    const runbooks: Array<{ service: string; name: string; steps: string }> = [
      {
        service: "checkout",
        name: "checkout",
        steps:
          "1. Valide fila de checkout e confirme se há latência acima do SLO. 2. Reduza o volume de reprocessamento e confirme cache. 3. Se persistir, escale o serviço e abra incidente de engenharia.",
      },
      {
        service: "payments",
        name: "payments",
        steps:
          "1. Inspecione a fila de pagamentos e dead-letter. 2. Confirme retry storms e gateway upstream. 3. Desligue ou limite operações que geram backlog.",
      },
      {
        service: "auth",
        name: "auth",
        steps:
          "1. Verifique erros de autenticação e disponibilidade do provider. 2. Confirme se há token expiry em massa. 3. Reverte rollout ou redirecione tráfego.",
      },
    ];

    for (const runbook of runbooks) {
      const service = this.findServiceByName(runbook.service);
      if (!service) {
        continue;
      }

      const existing = this.db
        .prepare("SELECT * FROM runbooks WHERE service_id = ?")
        .get(service.id) as RunbookRecord | undefined;

      if (existing) {
        continue;
      }

      const insert = this.db.prepare(
        "INSERT INTO runbooks (service_id, name, steps) VALUES (?, ?, ?)",
      );
      insert.run(service.id, runbook.name, runbook.steps);
    }
  }
}
