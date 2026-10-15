/** Uma linha JSON por evento de trace e uma de resumo. Só metadados. */
import type { Metrics } from "../agents/types.js";

export type LogSink = (line: string) => void;

export interface TraceLogInput {
  requestId: string;
  seq: number;
  type: string;
  node: string;
}

export interface RequestLogInput {
  requestId: string;
  status: number;
  metrics?: Metrics;
}

export interface RequestLogger {
  traceEvent(input: TraceLogInput): void;
  request(input: RequestLogInput): void;
}

function writeLine(sink: LogSink, value: Record<string, unknown>): void {
  sink(`${JSON.stringify(value)}\n`);
}

export function createRequestLogger(
  sink: LogSink = (line) => {
    process.stdout.write(line);
  },
): RequestLogger {
  return {
    traceEvent(input) {
      writeLine(sink, {
        ts: new Date().toISOString(),
        level: "info",
        kind: "trace",
        requestId: input.requestId,
        seq: input.seq,
        type: input.type,
        node: input.node,
      });
    },
    request(input) {
      const line: Record<string, unknown> = {
        ts: new Date().toISOString(),
        level: "info",
        kind: "request",
        requestId: input.requestId,
        status: input.status,
      };
      if (input.metrics !== undefined) {
        line.metrics = input.metrics;
      }
      writeLine(sink, line);
    },
  };
}
