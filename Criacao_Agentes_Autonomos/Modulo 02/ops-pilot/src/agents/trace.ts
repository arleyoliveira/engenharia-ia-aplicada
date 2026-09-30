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
    case "route":
      return `[route] ${event.route} override=${event.override} ${event.reason}`;
    case "fallback":
      return `[fallback] ${event.from} → ${event.to}`;
    case "handoff":
      return `[handoff] ${event.to} ${event.brief}`;
    default:
      return `[${event.type}] ${event.content}`;
  }
}

export function formatTrace(trace: readonly TraceEvent[]): string {
  return trace.map(formatEvent).join("\n");
}

export function summarizeMetrics(metrics: Metrics): string {
  const history =
    metrics.historyMessages === undefined
      ? ""
      : ` historyMessages=${metrics.historyMessages}`;
  const prompt =
    metrics.promptTokens === undefined
      ? ""
      : ` promptTokens=${metrics.promptTokens}`;
  const fallbacks =
    metrics.fallbacks === undefined ? "" : ` fallbacks=${metrics.fallbacks}`;
  return `llmCalls=${metrics.llmCalls} latencyMs=${metrics.latencyMs}${history}${prompt}${fallbacks}`;
}
