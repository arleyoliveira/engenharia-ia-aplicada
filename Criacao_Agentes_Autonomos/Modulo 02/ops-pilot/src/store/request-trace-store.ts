/** Persistência do pedido de chat e do trace, no DatabaseSync já aberto. */
import type { DatabaseSync } from "node:sqlite";
import type { Metrics, TraceEvent } from "../agents/types.js";
import {
  aggregateRequestStats,
  modelFromTrace,
  routeFromTrace,
  statRowFromStored,
  type RequestStats,
  type RequestStatus,
} from "../obs/request-stats.js";

export interface ChatRequestRecord {
  requestId: string;
  conversationId: string;
  createdAt: string;
  metrics: Metrics;
  trace: TraceEvent[];
}

export interface RequestTraceSaveInput {
  requestId: string;
  conversationId: string;
  metrics: Metrics;
  trace: readonly TraceEvent[];
  route?: string;
  model?: string;
  status?: RequestStatus;
  /** ISO-8601. Omissão usa o instante do save. */
  createdAt?: string;
}

export interface RequestTraceStore {
  save(input: RequestTraceSaveInput): void;
  findById(requestId: string): ChatRequestRecord | null;
  stats(since: string, sinceMs: number, now?: Date): RequestStats;
}

type RequestRow = {
  id: string;
  conversationId: string;
  createdAt: string;
  metricsJson: string;
};

type EventRow = {
  payloadJson: string;
};

export class SqliteRequestTraceStore implements RequestTraceStore {
  constructor(private readonly db: DatabaseSync) {}

  save(input: RequestTraceSaveInput): void {
    const insertRequest = this.db.prepare(
      `INSERT INTO requests (
         id, conversation_id, created_at, metrics_json, route, model, status, prompt_tokens, latency_ms
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertEvent = this.db.prepare(
      "INSERT INTO trace_events (request_id, position, node, payload_json) VALUES (?, ?, ?, ?)",
    );

    this.db.exec("BEGIN");
    try {
      insertRequest.run(
        input.requestId,
        input.conversationId,
        input.createdAt ?? new Date().toISOString(),
        JSON.stringify(input.metrics),
        input.route ?? routeFromTrace(input.trace),
        input.model ?? modelFromTrace(input.trace),
        input.status ?? "ok",
        input.metrics.promptTokens ?? 0,
        input.metrics.latencyMs,
      );
      input.trace.forEach((event, position) => {
        insertEvent.run(
          input.requestId,
          position,
          event.node ?? "",
          JSON.stringify(event),
        );
      });
      this.db.exec("COMMIT");
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
        // A exceção original é a que o chamador precisa ver.
      }
      throw error;
    }
  }

  findById(requestId: string): ChatRequestRecord | null {
    const row = this.db
      .prepare(
        `SELECT id, conversation_id AS conversationId, created_at AS createdAt, metrics_json AS metricsJson
         FROM requests WHERE id = ?`,
      )
      .get(requestId) as RequestRow | undefined;
    if (!row) {
      return null;
    }

    const events = this.db
      .prepare(
        `SELECT payload_json AS payloadJson FROM trace_events
         WHERE request_id = ? ORDER BY position ASC`,
      )
      .all(requestId) as EventRow[];

    return {
      requestId: row.id,
      conversationId: row.conversationId,
      createdAt: row.createdAt,
      metrics: JSON.parse(row.metricsJson) as Metrics,
      trace: events.map((event) => JSON.parse(event.payloadJson) as TraceEvent),
    };
  }

  stats(since: string, sinceMs: number, now: Date = new Date()): RequestStats {
    const cutoff = new Date(now.getTime() - sinceMs).toISOString();
    const raw = this.db
      .prepare(
        `SELECT r.id, r.route, r.model, r.status,
                r.prompt_tokens AS promptTokens, r.latency_ms AS latencyMs,
                r.metrics_json AS metricsJson, e.payload_json AS payloadJson
         FROM requests r
         LEFT JOIN trace_events e ON e.request_id = r.id
         WHERE r.created_at >= ?
         ORDER BY r.id, e.position`,
      )
      .all(cutoff) as Array<{
      id: string;
      route: string;
      model: string;
      status: RequestStatus;
      promptTokens: number;
      latencyMs: number;
      metricsJson: string;
      payloadJson: string | null;
    }>;

    const grouped = new Map<string, { header: (typeof raw)[number]; trace: TraceEvent[] }>();
    for (const row of raw) {
      const current = grouped.get(row.id);
      if (!current) {
        grouped.set(row.id, {
          header: row,
          trace: row.payloadJson ? [JSON.parse(row.payloadJson) as TraceEvent] : [],
        });
        continue;
      }
      if (row.payloadJson) {
        current.trace.push(JSON.parse(row.payloadJson) as TraceEvent);
      }
    }

    const rows = [...grouped.values()].map(({ header, trace }) =>
      statRowFromStored({
        route: header.route,
        model: header.model,
        status: header.status,
        promptTokens: header.promptTokens,
        latencyMs: header.latencyMs,
        metrics: JSON.parse(header.metricsJson) as Metrics,
        trace,
      }),
    );
    return aggregateRequestStats(rows, since);
  }
}
