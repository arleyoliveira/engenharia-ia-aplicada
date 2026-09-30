export type AlertStatus = "firing" | "resolved";
export type Severity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "resolved";
export type IncidentFilter = IncidentStatus | "all" | { status?: IncidentStatus | "all" };

export interface ServiceRecord {
  id: number;
  name: string;
  tier: "critical" | "high" | "standard";
}

export interface AlertRecord {
  id: number;
  serviceId: number;
  service?: string;
  title: string;
  status: AlertStatus;
}

export interface IncidentRecord {
  id: number;
  title: string;
  serviceId: number;
  service?: string;
  severity: Severity;
  status: IncidentStatus;
  createdAt: string;
  resolvedAt: string | null;
  summary: string | null;
}

export interface RunbookRecord {
  id: number;
  serviceId: number;
  service?: string;
  name: string;
  steps: string;
}

export interface OpsStore {
  listAlerts(filter?: { status?: AlertStatus }): Promise<AlertRecord[]>;
  openIncident(input: {
    title: string;
    service: string;
    severity: Severity;
  }): Promise<IncidentRecord>;
  resolveIncident(input: { id: number }): Promise<IncidentRecord>;
  listIncidents(filter?: IncidentFilter): Promise<IncidentRecord[]>;
  getRunbook(service: string): Promise<RunbookRecord>;
  seedMercado(): Promise<void>;
  ensureService?(name: string, tier?: "critical" | "high" | "standard"): Promise<ServiceRecord>;
  ensureAlert?(input: {
    service: string;
    title: string;
    status: AlertStatus;
  }): Promise<AlertRecord>;
}
