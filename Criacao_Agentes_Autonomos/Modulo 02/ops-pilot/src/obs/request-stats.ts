/** Agregação pura dos pedidos gravados. Sem IO. */
import type { Metrics, TraceEvent } from "../agents/types.js";

export type RequestStatus = "ok" | "error";

export interface RequestStatRow {
  route: string;
  model: string;
  status: RequestStatus;
  promptTokens: number;
  latencyMs: number;
}

export interface LatencyStats {
  p50: number;
  p95: number;
}

export interface StatsBucket {
  total: number;
  errors: number;
  tokens: number;
  cost: number;
  latencyMs: LatencyStats;
}

export interface RouteStats extends StatsBucket {
  route: string;
}

export interface ModelStats extends StatsBucket {
  model: string;
}

export interface RequestStats extends StatsBucket {
  since: string;
  byRoute: RouteStats[];
  byModel: ModelStats[];
}

const SINCE_PATTERN = /^(\d+)(s|m|h|d)$/;

const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** `24h`, `30m`, `7d`, `60s`. Unidade inválida ou quantidade &lt; 1 → null. */
export function sinceToMs(since: string): number | null {
  const match = SINCE_PATTERN.exec(since.trim().toLowerCase());
  if (!match) {
    return null;
  }
  const amount = Number(match[1]);
  const unit = match[2];
  if (!Number.isInteger(amount) || amount < 1 || unit === undefined) {
    return null;
  }
  return amount * UNIT_MS[unit];
}

/** Modelo OpenRouter com sufixo `:free` não gera custo. Sem tabela de preço, os demais também ficam em 0. */
export function requestCost(model: string, _tokens: number): number {
  if (model.endsWith(":free")) {
    return 0;
  }
  return 0;
}

export function routeFromTrace(trace: readonly TraceEvent[]): string {
  const event = trace.find((item) => item.type === "route");
  return event?.type === "route" ? event.route : "";
}

export function modelFromTrace(
  trace: readonly TraceEvent[],
  env: NodeJS.ProcessEnv = process.env,
): string {
  const fallbacks = trace.filter((item) => item.type === "fallback");
  const last = fallbacks.at(-1);
  if (last?.type === "fallback") {
    return last.to;
  }
  return env.OPENROUTER_MODEL?.trim() ?? "";
}

/**
 * Colunas gravadas antes do agregado vêm vazias. O JSON do pedido e o trace
 * continuam sendo a fonte quando a coluna está no padrão.
 */
export function statRowFromStored(input: {
  route: string;
  model: string;
  status: RequestStatus;
  promptTokens: number;
  latencyMs: number;
  metrics: Metrics;
  trace: readonly TraceEvent[];
  env?: NodeJS.ProcessEnv;
}): RequestStatRow {
  const route = input.route.trim() || routeFromTrace(input.trace);
  const model = input.model.trim() || modelFromTrace(input.trace, input.env);
  return {
    route,
    model,
    status: input.status,
    promptTokens: input.promptTokens > 0 ? input.promptTokens : (input.metrics.promptTokens ?? 0),
    latencyMs: input.latencyMs > 0 ? input.latencyMs : (input.metrics.latencyMs ?? 0),
  };
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index] ?? 0;
}

function bucketOf(rows: readonly RequestStatRow[]): StatsBucket {
  const latencies = rows.map((row) => row.latencyMs);
  return {
    total: rows.length,
    errors: rows.filter((row) => row.status === "error").length,
    tokens: rows.reduce((sum, row) => sum + row.promptTokens, 0),
    cost: rows.reduce((sum, row) => sum + requestCost(row.model, row.promptTokens), 0),
    latencyMs: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
    },
  };
}

function grouped(rows: readonly RequestStatRow[], key: "route" | "model"): Array<[string, RequestStatRow[]]> {
  const groups = new Map<string, RequestStatRow[]>();
  for (const row of rows) {
    const name = row[key];
    const list = groups.get(name);
    if (list) {
      list.push(row);
    } else {
      groups.set(name, [row]);
    }
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
}

export function emptyRequestStats(since: string): RequestStats {
  return {
    since,
    ...bucketOf([]),
    byRoute: [],
    byModel: [],
  };
}

export function aggregateRequestStats(
  rows: readonly RequestStatRow[],
  since: string,
): RequestStats {
  return {
    since,
    ...bucketOf(rows),
    byRoute: grouped(rows, "route").map(([route, group]) => ({ route, ...bucketOf(group) })),
    byModel: grouped(rows, "model").map(([model, group]) => ({ model, ...bucketOf(group) })),
  };
}
