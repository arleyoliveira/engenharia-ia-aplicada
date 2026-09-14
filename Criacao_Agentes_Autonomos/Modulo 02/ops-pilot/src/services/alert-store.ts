/**
 * Store de alertas/incidentes: lógica de domínio sobre repositórios injetados.
 * Funções puras de decisão; efeitos ficam nos repositórios (models Sequelize
 * em produção, fakes in-memory nos testes).
 */
import { NotFoundError } from "../errors.js";

export type AlertStatus = "firing" | "resolved";
export type Severity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "resolved";

export interface AlertView {
  id: number;
  service: string;
  title: string;
  status: AlertStatus;
}

export interface IncidentView {
  id: number;
  title: string;
  service: string;
  severity: Severity;
  status: IncidentStatus;
  resolvedAt: Date | null;
}

export interface ServiceRecord {
  id: number;
  name: string;
}

export interface AlertRecord {
  id: number;
  serviceId: number;
  title: string;
  status: AlertStatus;
}

export interface IncidentRecord {
  id: number;
  serviceId: number;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  resolvedAt: Date | null;
}

/** Fronteira de IO: implementada pelos models Sequelize ou por fakes. */
export interface StoreRepos {
  services: {
    findByName(name: string): Promise<ServiceRecord | null>;
    create(name: string): Promise<ServiceRecord>;
  };
  alerts: {
    findByTitle(title: string): Promise<AlertRecord | null>;
    create(input: {
      serviceId: number;
      title: string;
      status: AlertStatus;
    }): Promise<AlertRecord>;
    list(status?: AlertStatus): Promise<AlertRecord[]>;
  };
  incidents: {
    create(input: {
      serviceId: number;
      title: string;
      severity: Severity;
    }): Promise<IncidentRecord>;
    findById(id: number): Promise<IncidentRecord | null>;
    markResolved(id: number, resolvedAt: Date): Promise<IncidentRecord>;
  };
  /** Nome do serviço por id (join feito pela implementação concreta). */
  serviceName(serviceId: number): Promise<string>;
}

export interface AlertStore {
  listAlerts(filter: { status?: AlertStatus }): Promise<AlertView[]>;
  openIncident(input: {
    title: string;
    service: string;
    severity: Severity;
  }): Promise<IncidentView>;
  resolveIncident(input: { id: number }): Promise<IncidentView>;
  ensureService(name: string): Promise<ServiceRecord>;
  ensureAlert(input: {
    service: string;
    title: string;
    status: AlertStatus;
  }): Promise<AlertRecord>;
}

async function toIncidentView(
  repos: StoreRepos,
  record: IncidentRecord,
): Promise<IncidentView> {
  return {
    id: record.id,
    title: record.title,
    service: await repos.serviceName(record.serviceId),
    severity: record.severity,
    status: record.status,
    resolvedAt: record.resolvedAt,
  };
}

export function createAlertStore(repos: StoreRepos): AlertStore {
  return {
    async listAlerts({ status }) {
      const alerts = await repos.alerts.list(status);
      const views: AlertView[] = [];
      for (const alert of alerts) {
        views.push({
          id: alert.id,
          service: await repos.serviceName(alert.serviceId),
          title: alert.title,
          status: alert.status,
        });
      }
      return views;
    },

    async openIncident({ title, service, severity }) {
      const found = await repos.services.findByName(service);
      if (!found) {
        throw new NotFoundError(`Serviço não encontrado: ${service}`);
      }
      const record = await repos.incidents.create({
        serviceId: found.id,
        title,
        severity,
      });
      return toIncidentView(repos, record);
    },

    async resolveIncident({ id }) {
      const found = await repos.incidents.findById(id);
      if (!found) {
        throw new NotFoundError(`Incidente não encontrado: ${id}`);
      }
      if (found.status === "resolved") {
        // Idempotente: retorna o estado atual sem alterar resolvedAt.
        return toIncidentView(repos, found);
      }
      const updated = await repos.incidents.markResolved(id, new Date());
      return toIncidentView(repos, updated);
    },

    async ensureService(name) {
      const existing = await repos.services.findByName(name);
      return existing ?? repos.services.create(name);
    },

    async ensureAlert({ service, title, status }) {
      const existing = await repos.alerts.findByTitle(title);
      if (existing) {
        return existing;
      }
      const svc = await repos.services.findByName(service);
      if (!svc) {
        throw new NotFoundError(`Serviço não encontrado: ${service}`);
      }
      return repos.alerts.create({ serviceId: svc.id, title, status });
    },
  };
}

/** Catálogo inicial (data-model.md): idempotente por chave natural. */
export type SeedCatalog = {
  services: readonly string[];
  alerts: ReadonlyArray<{
    service: string;
    title: string;
    status: AlertStatus;
  }>;
};

export async function seedCatalog(
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
