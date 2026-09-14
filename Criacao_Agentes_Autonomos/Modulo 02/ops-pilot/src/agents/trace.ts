/** Formatação pura e determinística de traces e métricas. */
import type { Metrics, TraceEvent } from "./types.js";

function formatEvent(event: TraceEvent): string {
  switch (event.type) {
    case "action":
      return `[action] ${event.tool}(${JSON.stringify(event.args)})`;
    case "plan":
      return `[plan] ${event.steps
        .map((step, index) => `${index + 1}. ${step}`)
        .join(" | ")}`;
    default:
      return `[${event.type}] ${event.content}`;
  }
}

export function formatTrace(trace: readonly TraceEvent[]): string {
  return trace.map(formatEvent).join("\n");
}

export function summarizeMetrics(metrics: Metrics): string {
  return `llmCalls=${metrics.llmCalls} latencyMs=${metrics.latencyMs}`;
}
