/**
 * Repositórios in-memory para testes determinísticos (sem banco, sem rede).
 */
import type {
  AlertRecord,
  AlertStatus,
  IncidentRecord,
  Severity,
  ServiceRecord,
  StoreRepos,
} from "./alert-store.js";

export interface MemoryState {
  services: ServiceRecord[];
  alerts: AlertRecord[];
  incidents: IncidentRecord[];
  nextId: number;
}

export function createMemoryRepos(): StoreRepos & { state: MemoryState } {
  const state: MemoryState = {
    services: [],
    alerts: [],
    incidents: [],
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
          resolvedAt: null,
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
    },
    async serviceName(serviceId) {
      return (
        state.services.find((s) => s.id === serviceId)?.name ??
        `#${serviceId}`
      );
    },
  };
}
