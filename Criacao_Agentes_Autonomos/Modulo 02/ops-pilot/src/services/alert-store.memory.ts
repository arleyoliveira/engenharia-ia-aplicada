/**
 * Repositórios in-memory para testes determinísticos (sem banco, sem rede).
 */
import type {
  AlertRecord,
  AlertStatus,
  IncidentRecord,
  IncidentStatus,
  RunbookRecord,
  Severity,
  ServiceRecord,
  StoreRepos,
} from "./alert-store.js";

export interface MemoryState {
  services: ServiceRecord[];
  alerts: AlertRecord[];
  incidents: IncidentRecord[];
  runbooks: RunbookRecord[];
  nextId: number;
}

export function createMemoryRepos(): StoreRepos & { state: MemoryState } {
  const state: MemoryState = {
    services: [],
    alerts: [],
    incidents: [],
    runbooks: [],
    nextId: 1,
  };

  return {
    state,
    services: {
      async findByName(name) {
        return state.services.find((s) => s.name === name) ?? null;
      },
      async create(name) {
        const record: ServiceRecord = { id: state.nextId++, name };
        state.services.push(record);
        return record;
      },
    },
    alerts: {
      async findByTitle(title) {
        return state.alerts.find((a) => a.title === title) ?? null;
      },
      async create(input) {
        const record: AlertRecord = { id: state.nextId++, ...input };
        state.alerts.push(record);
        return record;
      },
      async list(status?: AlertStatus) {
        return status
          ? state.alerts.filter((a) => a.status === status)
          : [...state.alerts];
      },
    },
    incidents: {
      async create(input: {
        serviceId: number;
        title: string;
        severity: Severity;
      }) {
        const record: IncidentRecord = {
          id: state.nextId++,
          ...input,
          status: "open",
          createdAt: new Date().toISOString(),
          resolvedAt: null,
          summary: null,
        };
        state.incidents.push(record);
        return record;
      },
      async findById(id) {
        return state.incidents.find((i) => i.id === id) ?? null;
      },
      async markResolved(id, resolvedAt) {
        const record = state.incidents.find((i) => i.id === id);
        if (!record) {
          throw new Error(`incident ${id} desapareceu`);
        }
        record.status = "resolved";
        record.resolvedAt = resolvedAt;
        return record;
      },
      async list(status?: IncidentStatus | "all") {
        if (!status || status === "open") {
          return state.incidents.filter((i) => i.status === "open");
        }
        if (status === "resolved") {
          return state.incidents.filter((i) => i.status === "resolved");
        }
        if (status === "all") {
          return [...state.incidents];
        }
        return state.incidents.filter((i) => i.status === status);
      },
    },
    runbooks: {
      async findByServiceId(serviceId: number) {
        return state.runbooks.find((r) => r.serviceId === serviceId) ?? null;
      },
      async create(input) {
        const record: RunbookRecord = { id: state.nextId++, ...input };
        state.runbooks.push(record);
        return record;
      },
      async list() {
        return [...state.runbooks];
      },
    },
    async serviceName(serviceId) {
      return (
        state.services.find((s) => s.id === serviceId)?.name ??
        `#${serviceId}`
      );
    },
  };
}
